/*
 * LoL Idle — Auto Poção · automation.js  (world: ISOLATED)
 *
 * Motor de decisão da rotina (spec: docs/automation-spec.md). Nesta versão roda
 * em MODO OBSERVAÇÃO: lê o estado, calcula o plano (o que guardar/vender/anunciar,
 * repor poção, região) e publica na GUI — sem agir. As ações (keybinds/cliques)
 * entram quando o dono validar o plano.
 *
 * Leitura do estado:
 *   #st-ouro            -> ouro
 *   #local-nome         -> local/região atual (ex.: "Rio nível 25–35")
 *   #hud-pocoes [data-pocao] -> contagem das poções
 *   #mochila button.slot[data-id] -> itens ("<base>~<qual>") e espólio
 *                                     ("esp:<id>:<qtd>"); #mochila-qtd "(8/30)"
 */
(() => {
  'use strict';

  const STORAGE_KEY = 'lolidleAutoPotion';
  const PLAN_KEY = STORAGE_KEY + ':plan';

  const RARITY = { basico: 0, epico: 1, lendario: 2 };
  const QUAL = ['C', 'B', 'A', 'S', 'SS'];
  const qIdx = (q) => QUAL.indexOf(q);   // -1 = qualidade DESCONHECIDA ('?' sendo avaliada) — nunca tratar como C
  const RABADON = '3089';
  /** ============ ITENS DE PRIORIDADE EXTREMA — POR CLASSE (regra do dono, 2026-10-14) ============
   *  REGRA DO DONO (verbatim): "todos os bonecos tem que saber a build ideal deles, e quais
   *  itens sao de extrema prioridade e que nao devem ser tocados pelas nossas regras de auto
   *  clean, tipo gume do infinito e rabaddon. mesmo duplicados, e o jogador que decide com eles."
   *
   *  A LISTA SAI DO MOTOR, não de gosto: são os itens que o motor lê PELO ID para MULTIPLICAR o
   *  stat central de cada classe de dano (o bloco `tem('id')` de motor.js:504-524):
   *    3031 Gume do Infinito -> `danoCritico += 0.4`   (motor.js:515)  [classe AD]
   *    3089 Rabadon          -> `ap *= 1.35`           (motor.js:522)  [classe AP]
   *  São os DOIS ÚNICOS multiplicadores de classe desse bloco. Os outros `tem()` de lá SOMAM ao
   *  total (motor.js:514 `2501: ad += 0.02*(vida-baseVida)`; motor.js:521 `3003: ap += 0.03*mana`)
   *  ou dão penetração (motor.js:539 `3036: 30%`), logo não têm a mesma natureza: não mudam a
   *  RÉGUA do boneco — são somas, não multiplicadores.
   *
   *  REGRA: um item desta lista NUNCA é vendido nem anunciado — NEM DUPLICADO (o duplicado fica
   *  na mochila e a decisão é do jogador). Isto ABSORVE a guarda solta que existia só para o
   *  Rabadon (`RABADON`, automation.js:25): ele passa a ser UM CASO da regra, com o
   *  comportamento dele intacto (era protegido em QUALQUER campeão — ver `isProtected`,
   *  `isMarketable`, `planBag`, `venderBase`, `anunciarLendarios`), e o Gume do Infinito ganha
   *  a MESMA protecção. A protecção vale para qualquer campeão: o critério é o item ser um
   *  multiplicador de classe, e a extensão não sabe se o dono vai trocar de boneco. */
  const PRIORIDADE_EXTREMA = [
    { id: '3031', classe: 'ad', tipo: 'critico',      motivo: '+40% no dano do acerto crítico (o multiplicador do AD)', fonte: 'motor.js:515' },
    { id: '3089', classe: 'ap', tipo: 'multiplicador', motivo: '+35% em TODO o Poder de Habilidade (o multiplicador do AP)', fonte: 'motor.js:522' },
  ];
  const _PRIO_IDS = new Set(PRIORIDADE_EXTREMA.map((e) => e.id));
  /** '3089+2' / '3089~A' -> '3089' (mesma normalização do `especialDe`, automation.js:3677). */
  const basePura = (b) => String(b == null ? '' : b).replace(/[+~].*$/, '');
  /** É item de PRIORIDADE EXTREMA? (ver a tabela acima). Aceita o id do slot ('3031+2~A'). */
  const ehPrioridadeExtrema = (base) => _PRIO_IDS.has(basePura(base));
  /** A ficha (classe/motivo/fonte) do item de prioridade extrema, ou null. Para o log dizer
   *  PORQUE é que ele não foi tocado (mesma ideia do `especialDe`). */
  const prioExtremaDe = (base) => { const p = basePura(base); return PRIORIDADE_EXTREMA.find((e) => e.id === p) || null; };
  /** DEGRAU DE RARIDADE — a "restrição dura" da regra do dono ("EPICO e MELHOR que BASICO").
   *  Espelha o motor: motor.js:47 `raridade = (i) => i.raridade || (i.lendario ? 'lendario' : 'basico')`. */
  const RAR_IDX = { basico: 0, epico: 1, lendario: 2 };
  const rarIdx = (r) => (RAR_IDX[r] != null ? RAR_IDX[r] : 0);
  /** BARRA de combate: 4 habilidades — motor.js:900 `export const BARRA = 4`. */
  const BARRA_SLOTS = 4;
  /** DESBLOQUEAR vale mais que +1 rank numa que já existe (frase do dono, verbatim):
   *  "uma skill desbloqueada faz mais que UM PONTO em uma skill existente". O motor concorda:
   *  ao chegar a rank 1 a skill ENTRA SOZINHA na barra (motor.js:2817) — ganha-se uma
   *  habilidade INTEIRA (um slot da rotação), não um incremento. Multiplicador explícito
   *  para o desbloqueio nunca perder de um rank-up por detalhe de arredondamento. */
  const MULT_DESBLOQUEIO = 1.5;

  const DEFAULT = {
    enabled: false,          // modo observação até o dono ligar
    // PEDIDO DO DONO (2026-10-14, verbatim): "em uma nova conta, o script deve ativar autoplay
    // depois de 3 minutos SE FOR A PRIMEIRA VEZ DA CONTA/DO SCRIPT INSTALADO. se a conta tem o
    // nome 'convidado', auto play e ativado por padrao. agora, pra mim, que nao e a primeira vez
    // do script, o auto play e desligado por padrao."
    //   primeiraVezSeg       = 180 s (3 min) de espera antes de ligar SOZINHO, uma única vez.
    //   autoLigarPrimeiraVez = false desliga a funcionalidade INTEIRA (nem 'convidado' liga).
    // Os dois são configuráveis como todos os outros (a GUI escreve-os pelo setConfig).
    primeiraVezSeg: 180,
    autoLigarPrimeiraVez: true,
    regionDefault: null,     // id de região escolhido ou null = ideal p/ o nível
    // REGRA DO DONO (farm): "usar a que maximiza ouro+xp/min". O default passa a ser a
    // SOMA normalizada pelo próprio motor (ver `regiaoIdeal`), não um eixo só.
    // 'xp' | 'ouro' | 'runas' continuam válidos.
    objetivo: 'ouro+xp',
    // PEDIDO DO DONO (2026-10-14, verbatim): "faz funcionar bem o objetivo de farm/item.
    // quero settar o objetivo pra rabaddon."
    // O campo objetivo acima so pontua REGIOES. A build ideal era 100% EMERGENTE de
    // montarBuildDe() (soma ponderada de stats x multiplicador de classe), pelo que NAO
    // havia forma de dizer "quero este item": num campeao AD o Rabadon (AP) levava 0.12x
    // e nunca entrava. Este campo fixa um item como ALVO da build, a frente de tudo.
    // Valores: null (sem alvo) | 'rabadon' | id numerico de item (ex.: '3089').
    objetivoItem: null,
    keepEpicA: true,
    minPotion: { vida: 200, vidaF: 100, vidaS: 30 },
    buyPotion: { vida: 3000, vidaF: 1500, vidaS: 700 },
    idleBaseMs: 180000,
    trocaItens: false,        // trocar itens automaticamente por contexto (mob × chefe)
    // PEDIDO DO DONO (2026-10-14, verbatim): "tem q saber melhor build pra enfrentar mob e
    // melhor build pra enfrentar chefe ... e vai alternar entre o melhor pra mob e o melhor pra
    // chefe SOZINHO. e isso e desativavel. mas ativado por padrao."
    // -> LIGADO POR DEFECTO. Com `false` explícito o motor volta ao comportamento antigo
    //    (uma build só, a `buildIdeal()`): não alterna, não reserva peças e não vai ao cofre.
    buildPorFase: true,
    // PEDIDO DO DONO (2026-10-14, verbatim): "e pras skills trocarem sozinha. e ser desativavel.
    // por trocarem sozinha, eu digo no combate no mapa, onde todas as skills sao usadas, como ja
    // acontecia."
    // -> a BARRA passa a variar por fase, como a build ja variava: no combate de MAPA os mobs
    //    vem em grupo, logo prefere as skills com mais ALVOS (o `alvos` do kit, motor.js); no
    //    chefe prefere o dano de alvo unico. A ultimate continua SEMPRE dentro e em 1.o lugar.
    //    `false` desliga e volta a uma barra so (comportamento antigo).
    skillsPorFase: true,
    // BARRA POR DISPONIBILIDADE — PEDIDO DO DONO (2026-10-14, verbatim): "tu entende oq eu falo
    // das skills da barra? tu entende que antes funcionava de forma perfeita, onde usava tudo
    // disponivel (sem clicar nas skills, ja que o farm usa skill automatico, e coisa do jogo, por
    // isso idle) e ai removia dos slots pra colocar nos slots as que tavam mais proximas de serem
    // usadas, e assim em loop, o tempo inteiro?"
    // CONTRADIÇÃO DECLARADA (e resolvida a favor do dono): o comentário antigo da `barraIdeal`
    // chamava a isto O DEFEITO — "a versão antiga ordenava por `pronto` (recarga) e por isso a
    // barra mudava a cada 2 s". O dono diz que funcionava "de forma perfeita": era uma correcção
    // antiga ao que ele queria. -> DEFAULT TRUE. Com `false` explícito o motor volta ao
    // comportamento estável de hoje (há testes a depender dele).
    // Nada aqui CLICA em skills: a barra só decide QUAIS ficam equipadas (o farm usa as skills
    // automaticamente, é coisa do jogo).
    barraPorDisponibilidade: true,
    barraCadenciaMs: 2000,    // cadência própria da reavaliação da barra ("o tempo inteiro")
    pocaoPisoPct: 0.75,       // piso de HP FORA de chefe (% do máx)
    pocaoPisoChefe: 0.9,      // piso de HP NO CHEFE (mais seguro; a carga cobre o burst)
    pocaoMargem: 1.1,         // margem só na previsão da CARGA (física/mágica)
    ultWaveSeg: 12,           // segundos p/ 3 waves: acima disso vale usar a ultimate nos mobs (só se cfg.ultEmMobs)
    ultEmMobs: false,         // PADRÃO: NUNCA usar a ultimate em mobs — só no chefe (o dono pediu N vezes)
    killLentoMs: 3500,        // tempo mediano entre kills acima disso = área difícil (fallback sem burst)
    testeForcar: false,       // permite iniciar teste em região letal (default: recusa)
    testeMobSeg: 20,          // segundos de mobs por build no teste (20s = 3x amostra vs 60s)
    testeLoop: true,          // repete os conjuntos em loop acumulando amostras
    mobHpMinRel: 0.15,        // HP mín. relativo acima disso = sobrevive aos mobs (observado)
    // FUGA = SOBREVIVÊNCIA (regra do dono, verbatim: "e e pra fugir de qualquer coisa que mata,
    // pra qualquer boneco, em qualquer situacao" / "NAO E PRA MORRER, NUNCA, COM ESSE SCRIPT").
    // `fugir` é interruptor PRÓPRIO (pai `manutencao` na tabela INTERRUPTORES): o dono desliga
    // só isto sem desligar o resto. `fugirMs` = cooldown entre fugas (evita ping-pong).
    fugir: true,
    fugirMs: 30000,           // cooldown de fuga após detectar perigo de morte
    // PREÇO QUANDO NÃO HÁ COMPARÁVEL NO MERCADO. PEDIDO DO DONO (2026-10-14, verbatim): "1,5."
    // -> 1.500.000 de ouro, configurável. Sem isto o anúncio era PULADO ("sem referência de
    // preço") ou caía no MÍNIMO do jogo — que é muito baixo e vendia barato.
    precoSemComparavel: 1500000,
    // ===== WATCH-LIST DO MERCADO (PEDIDO DO DONO, 2026-10-18, verbatim): =====================
    //   "faz um subagent fazer auto compra no mercado, detectando em TEMPO REAL o mercado
    //    sobre os itens q eu quero dar watch. e por nome de player."
    // O dono vai testar com o nome 'srdog' (um amigo). A deteccao le o mercado do SERVIDOR
    // (GET /api/mercado -> jogo.js:2513/rede.mercado; a mesma rota leve de jogo.js:3001)
    // para ver TODAS as ofertas com vendedor em tempo real; a compra sai pelo MERCADO do
    // jogo (clique em [data-comprar]) para o 'estado' da conta ficar sincronizado
    // (jogo.js:2954-2960 -> operarServidor -> POST /api/mercado/comprar, jogo.js:2825).
    autoVigiarMercado: true,   // interruptor proprio (arvore: vigiarMercado, pai manutencao)
    mercadoWatch: {
      itens: [],        // watch por id-base ("3031"), id completo ("3071+2~S") ou NOME ("Gume do Infinito")
      vendedores: [],   // watch por NOME de jogador (sem distinguir maiusculas, ex.: 'srdog')
      precoMax: null,   // tecto de preco por oferta (em OURO); null = so a reserva de ouro
      tetoCompra: 500000,   // gasto maximo por passagem do poller (em OURO)
      cadenciaMs: 5000,     // cadencia do poller em tempo real
    },
    // ===== WATCH-LIST DO MERCADO (fim) ========================================================
    // PENALIZAÇÃO de item da CLASSE OPOSTA no SCORING. O motor do jogo NÃO restringe itens por
    // classe (isso só existe nas TABELAS DE DROP, motor.js:408) — esta penalização é da extensão.
    // Estava em 0.12 (8,3x) e INVERTIA diferenças medidas: a build AD/crítico da Katarina faz +38%
    // de DPS em mobs e +126% no chefe (docs/build-ideal-final.md, decisão do dono: "sim, mano") e
    // nunca ganhava. Passa a SUAVE e configurável. NÃO substitui as PROTECÇÕES de item (um item AP
    // num campeão AP continua intocável pelo ITENS_ESPECIAIS/ehEspecialMeu — coisas diferentes).
    // DEFAULT 0.12 = o valor de sempre (o banco de regressão fixa o comportamento do equipamento com
    // ele). MEDIDO ao subir para 0.75 e 1.0: as builds da Katarina NÃO mudam — a penalização de
    // classe não é o bloqueio da build AD dela (o bloqueio é o PERFIL: `pesosItem('mago')` tem
    // `ad: 0`, logo o AD de um item AD vale ZERO pontos). Fica configurável para o dono testar.
    pesoClasseOposta: 0.12,
    // IDA À FONTE PARA LER O COFRE. PEDIDO DO DONO (2026-10-14, verbatim): "e anda pra fonte la mano,
    // nao fez isso ainda por que? tu quer usar a tesoureira sem andar pra fonte? por que andar pra
    // fonte nao e a porra do BASICO q tem q fazer autoamtico?"
    // -> tarefa PERIÓDICA com cadência própria (10 min), não um need eterno. MEDIDO: `cofreItens: 0`,
    // `cofreAt: null` — o cofre nunca era lido porque a rotina só subia à Fonte para vender.
    cofreCadenciaMin: 10,
    // LOJISTA = DESCARTE, NÃO RECEITA. REGRA DO DONO (2026-10-14, verbatim): "o lojista, eu ja
    // falei que e a mesma coisa que jogar item no lixo. lojista nao da dinheiro. so quando e o
    // comeco do jogo. pronto."
    // EXCEPÇÃO "começo do jogo": o fim da PRIMEIRA faixa do mapa — `LOCAIS.rota-inf.faixa = [1,10]`
    // (motor.js:357, a região "por onde todo mundo começa"). O default é DERIVADO do META; este
    // campo só existe para o dono sobrepor. Até este nível o ouro da venda conta; depois, não.
    inicioJogoAteNivel: 10,
    // REGRA DO DONO (inviolável): "Gastar TODOS os pontos: skill points ... e attribute points".
    // Logo o default é LIGADO; `false` explícito desliga.
    autoAtrib: true,          // distribui automaticamente os pontos de atributo livres
    modeloAtrib: null,        // força um modelo; null = MODELO DERIVADO do campeão (`modeloAtribDe`)
    champAlvo: 'yasuo',       // auto-play SO neste campeao (regra do dono); null = qualquer
    manutencao: true,         // RECURSO BASE do script: vender/equipar/mercado/pontos/cofre
    // PEDIDO DO DONO (2026-10-14, verbatim): "o auto play e pra decidir tudo pelo usuario, ate
    // que itens equipar e onde farmar SOZINHO. e auto play literal, joga sem o usuario nem
    // existir na conta, nem precisando do usuario. ja vender itens pro lojista, botar no mercado
    // e etc, deve ser recurso padrao do script ... faca por padrao essas coisas ativadas".
    // -> AUDITORIA das flags: vender no Lojista e anunciar no mercado JA sao incondicionais
    //    (nao ha flag; saem do planBag). autoEquip/autoAtrib/autoMontar/buildPorFase/
    //    skillsPorFase/rotacaoSkills ja nasciam LIGADAS. A UNICA accao que nascia DESLIGADA era
    //    o refino -> passa a true. As que continuam false sao deliberadas e nao sao accoes:
    //    `enabled` (interruptor-mestre, modo observacao ate o dono ligar), `ultEmMobs` (o dono
    //    proibiu a ultimate em mobs), `testeForcar` (so para testes) e `trocaItens` (caminho
    //    ANTIGO, substituido pelo buildPorFase — ligar os dois punha-os a lutar entre si).
    autoRefino: true,         // refina no Ornn itens LENDÁRIOS A+ até +3 (PADRAO LIGADO)
    // REGRA DO DONO (inviolável): "Equipar SEMPRE o melhor item disponível em cada slot".
    // Logo o default é LIGADO; `false` explícito desliga.
    autoEquip: true,
    // HISTERESE do equipador: só serve para trocas LATERAIS (mesmo degrau de raridade e sem
    // item especial). Trocas de RARIDADE SUPERIOR e itens ESPECIAIS ignoram-na (regra do dono:
    // a raridade decide "antes de qualquer histerese"). 1.05 = valor que já existia (docs/itens-ideal.md D10).
    equipHisterese: 1.05,
  };
  let cfg = structuredClone(DEFAULT);

  const SUFIXO = { k: 1e3, K: 1e3, m: 1e6, M: 1e6 };   // cena.js:225 — k = x1000, M = x1000000
  const parseNum = (s, suf) => {
    const t = String(s == null ? '' : s).trim();
    if (!t) return NaN;
    const mS = t.match(/([kKmM])\s*$/);
    const sufixo = mS ? mS[1] : (suf != null ? String(suf).trim() : '');
    const d = t.replace(/[^\d.,]/g, '');
    if (!d) return NaN;
    const v = /^\d{1,3}([.,]\d{3})+$/.test(d) ? Number(d.replace(/[.,]/g, ''))
      : /^\d+[.,]\d+$/.test(d) ? Number(d.replace(',', '.'))
        : Number(d.replace(/[.,]/g, ''));
    return Number.isFinite(v) ? v * (SUFIXO[sufixo] || 1) : NaN;
  };
  const numOr = (v, d) => Number.isFinite(v) ? v : d;

  // ------------------------------------------------------------- keybinds
  function press(key) {
    const o = { key, code: 'Key' + key.toUpperCase(), bubbles: true, cancelable: true };
    document.dispatchEvent(new KeyboardEvent('keydown', o));
    setTimeout(() => document.dispatchEvent(new KeyboardEvent('keyup', o)), 60 + Math.random() * 90);   // solta a tecla com jitter
  }

  // ------------------------------------------------------------- leitura
  function readGold() {
    const t = document.querySelector('#st-ouro')?.textContent || '';
    if (/M/i.test(t)) return Math.round(parseFloat(t) * 1e6);
    if (/k/i.test(t)) return Math.round(parseFloat(t) * 1e3);
    return parseNum(t);
  }
  function readLocation() {
    const t = document.querySelector('#local-nome')?.textContent || '';
    const m = t.match(/nível\s*(\d+)[–-](\d+)/i);
    return { text: t.trim(), tier: null, range: m ? [+m[1], +m[2]] : null };
  }
  function readPotions() {
    const out = {};
    for (const b of document.querySelectorAll('#hud-pocoes [data-pocao]')) {
      out[b.dataset.pocao] = parseNum(b.querySelector('b')?.textContent);
    }
    return out;
  }

  /** Capacidade da mochila no nível (motor: MOCHILA_INICIO + espacos × floor(nivel/niveis)). */
  function mochilaCap(nivel) {
    const m = META.mochila || { inicio: 20, niveis: 5, espacos: 2 };
    const n = nivel != null ? nivel : ((player() || {}).nivel || 1);
    return m.inicio + m.espacos * Math.floor(Math.min(META.nivelMax || 50, Math.max(1, n)) / m.niveis);
  }

  /** Lê a mochila SEM abrir nada. Devolve { cap, used, items:[...] }. */
  let _bagCache = null, _bagAt = 0;
  /** Lê a mochila. CACHE de 2 s: vários laços (loop/supervisar/itens) chamam em sequência.
   *  Use `scanBag(true)` p/ forçar uma releitura.
   *
   *  DEFEITO CORRIGIDO (dono, 2026-10-14: "para ler a mochila o jogo precisa de a abrir e
   *  fechar por um instante ... que ridiculo. arruma isso"). O código fazia `press('i')` ->
   *  lia -> `press('i')`, ou seja ABRIA E FECHAVA a bolsa a cada leitura, com churn visível na
   *  UI. Era desnecessário, e isto foi LIDO no motor do jogo, não suposto:
   *  jogo.js:6627 `preencherSlots('#mochila', lista, false, true)` corre dentro do
   *  `atualizarUI()` (jogo.js:6621-6634) SEM qualquer gate de visibilidade — o `#mochila` do
   *  DOM está SEMPRE actual, aberto ou fechado. Logo lê-se directamente.
   *  A guarda `if (!win) return null` fica: sem a janela no DOM não há mochila para ler. */
  function scanBag(force) {
    if (!force && _bagCache && Date.now() - _bagAt < 2000) return _bagCache;
    const win = document.querySelector('#janela-bolsa');
    if (!win) return null;
    const mo = document.querySelector('#mochila');
    const items = [];
    let espo = 0;
    if (mo) {
      for (const s of mo.children) {
        const id = s.getAttribute('data-id') || '';
        if (!id || id.startsWith('tranca')) continue; // slots trancados por nível
        if (id.startsWith('esp:')) {
          const [, espId, qty] = id.split(':');
          espo++;
          items.push({ kind: 'espolio', id: espId, qty: parseNum(qty), el: null });
          continue;
        }
        const [baseRaw, qual] = id.split('~');
        const base = String(baseRaw || '').replace(/\+.*$/, '');   // o id vem "<base>+<refino>~<qual>"
        const cls = String(s.className || '');
        const rar = cls.includes('lendario') ? 'lendario' : cls.includes('epico') ? 'epico' : cls.includes('basico') ? 'basico' : '?';
        const dica = s.getAttribute('data-dica') || '';
        const vendaM = dica.match(/Vale\s+([\d.,]+\s*[kKmM]?)\s+de ouro no Lojista/i);
        items.push({
          kind: 'item', base, qual: qual || 'C', raridade: rar, id, refino: (id.match(/\+(\d+)/) || [])[1] ? +(id.match(/\+(\d+)/)[1]) : 0,
          vendaLojista: vendaM ? parseNum(vendaM[1]) : null, dica, stats: parseDica(dica),
        });
      }
    }
    const qtd = document.querySelector('#mochila-qtd')?.textContent || '';
    const capM = qtd.match(/\((\d+)\s*\/\s*(\d+)\)/);
    _bagCache = { cap: capM ? +capM[2] : mochilaCap(), used: capM ? +capM[1] : items.length, espacosEspolio: espo, items };
    _bagAt = Date.now();
    return _bagCache;
  }

  // ------------------------------------------------------------- IDENTIDADE do campeão (classe/build)
  /** O campeão SEMPRE identificável: perfil + CLASSE de dano (ad/ap) + build ideal. Tudo que
   *  decide item passa por aqui — é o que faz "a classe do campeão" existir como fato, não
   *  como palpite espalhado. (REGRA DO DONO: o campeão atual tem que ser identificável
   *  pela CLASSE dele ou pela BUILD.) */
  function identidadeCampeao(c) {
    c = c || META.champAtual || {};
    const pap = c.papel || {};
    return {
      champ: c,
      nome: c.nome || pap.nome || null,
      id: c.id != null ? c.id : null,
      perfil: perfilDe(c),
      classe: c.magia ? 'ap' : 'ad',            // classe de dano: AD vs AP
      distancia: !!c.distancia,
      tank: perfilDe(c) === 'tanque',
    };
  }
  /** A CLASSE do campeão atual ('ad' | 'ap') — atalho. */
  function classeCampeao() { return identidadeCampeao().classe; }

  let _buildClasse = null;                     // memo: a build da classe é cara e muda pouco
  /** BUILD DA CLASSE = os itens que a build ideal DESTE campeão usa (1 bota + 4). Sem campeão
   *  carregado, não inventa: devolve lista vazia (nada é blindado por falta de identidade). */
  function buildDaClasse(c) {
    c = c || META.champAtual || null;
    if (!c) { _buildClasse = { chave: 'nenhum', ids: [], lend: new Set() }; return []; }
    const pap = c.papel || {};
    // A chave tem de cobrir TUDO que `perfilDe`/`buildIdealPara` leem: id, classe, distância e
    // papel (dano/recebido) + tamanho do catálogo. Sem `papel`, um memo antigo devolvia uma build
    // velha e um lendário QUE ENTROU na build ficava vendável.
    const chave = [c.id != null ? c.id : '', c.magia ? 'ap' : 'ad', c.distancia ? 'ranged' : 'melee',
      pap.dano, pap.recebido, (META.itens || []).length].join('|');
    if (_buildClasse && _buildClasse.chave === chave) return _buildClasse.ids;
    const ids = buildIdealPara(c);
    const lend = new Set();
    const minhaClasse = c.magia ? 'ap' : 'ad';
    for (const id of ids) {
      const it = (META.itens || []).find((x) => String(x.id) === String(id));
      if (!it || it.raridade !== 'lendario') continue;
      const cl = classeItem(id);
      if (cl === 'neutro' || cl === minhaClasse) lend.add(String(id));      // lendário DA CLASSE (nunca o da classe errada)
    }
    _buildClasse = { chave, ids, lend };
    return ids;
  }
  /** Os LENDÁRIOS da build da classe do campeão. REGRA DO DONO: um lendário desses NÃO é
   *  anunciado no mercado NEM vendido NEM desviado — nem por outra coisa. */
  function lendariosDaClasse() { buildDaClasse(); return _buildClasse.lend; }
  /** Esse item-base é lendário da build da classe? (aceita '3089+2'/'3089~A') */
  function ehLendarioDaBuild(base) {
    const b = String(base == null ? '' : base).replace(/[+~].*$/, '');
    return lendariosDaClasse().has(b);
  }

  // ------------------------------------------------------------- regras
  const isProtected = (it) => it.kind === 'item' && (
    !QUAL.includes(it.qual) ||                                  // '?' (sendo avaliado) = BLINDADO: pode virar A
    (it.raridade === 'lendario' && qIdx(it.qual) >= qIdx('A')) ||
    ehPrioridadeExtrema(it.base) ||                             // PRIORIDADE EXTREMA por classe (3031/3089): nem venda, nem mercado — NEM DUPLICADO
    ehEspecialMeu(it.base) ||                                   // TRATAMENTO ESPECIAL da minha classe (ver ITENS_ESPECIAIS)
    (it.raridade === 'lendario' && ehLendarioDaBuild(it.base)) || // lendário da BUILD DA CLASSE: intocável
    ehReservado(it.base)                                        // peça das builds mob/chefe (troca por fase): reservada
  );
  const isTrash = (it) => it.kind === 'item' && it.raridade === 'epico' && QUAL.includes(it.qual) && qIdx(it.qual) < qIdx('A');
  const isMarketable = (it) => it.kind === 'item' && it.raridade === 'lendario' && QUAL.includes(it.qual) && qIdx(it.qual) < qIdx('A') && !ehPrioridadeExtrema(it.base) && !ehLendarioDaBuild(it.base);
  /** REGRA DO DONO: acima de A (A, A+S, S, SS) o item NÃO É MEXIDO — nem vendido, nem
   *  deduplicado, nem anunciado. Vale para QUALQUER raridade, não só lendário. */
  const acimaDeA = (it) => it.kind === 'item' && QUAL.includes(it.qual) && qIdx(it.qual) >= qIdx('A');
  /** TIER de um item = qualidade × refino (ordena 'qual o maior tier possível'). */
  /** TIER de uma peça na ESCALA DO MOTOR — nao 'qualidade = 10 refinos'.
   *  motor.js:252  `m = (1 + BONUS_REFINO * ref) * (QUALIDADES[qual]?.mult || 1)`
   *  motor.js:55   `BONUS_REFINO = 0,12` (+12% por nivel de refino)
   *  motor.js:174-178 `QUALIDADES`: C 0,9 · B 1 · A 1,15 · S 1,35 · SS 1,7
   *  BUG MEDIDO: 'qIdx × 10 + refino' punha 1 qualidade (A) = 10 refinos, e 1 refino valia o
   *  mesmo que 1/10 de qualidade. Na escala do motor 1 qualidade (A = 1,15) vale ~1,25 refinos
   *  (1,15/1,12 = 1,25) e QUALIDADE ALTA vence REFINO ALTO: 'A+0' (1,15) > 'C+2' (1,24)? 1,24 >
   *  1,15 — refino 2 ainda ganha, mas 'A+0' (1,15) ja bate 'B+1' (1,12), que o tierDe antigo
   *  perdia (0 contra 1). O desempate entre instancias do MESMO base passa a usar o m do motor.
   *  Uso: ordenação (quanto maior, melhor). QUALIDADE DESCONHECIDA ('?') = 1 (sem multiplicador). */
  const tierDe = (i) => (1 + BONUS_REFINO * (i.refino || 0)) * (QUAL_MULT[String(i.qual || 'B').toUpperCase()] || 1);

  /** FOLHAS DE RECEITA que ainda faltam para montar a build (B do critério do filtro).
   *  TK-02-27 / parte-02.md:1302-1303: "B = folhas das receitas que ainda vais montar;
   *  B=0 → clicar". No plano COMPRAR PRONTO (cfg.autoComprar — comprar o item montado em
   *  vez de o montar) não há receita a montar: B=0 desde o abate 1 → clicar já.
   *  A expansão das receitas é a do `basicosDaBuild` (catálogo do motor, `de` de cada item);
   *  o que já tenho na mochila sai da conta. */
  function folhasDeReceitaFaltando() {
    if (cfg.autoComprar) return 0;               // plano comprar pronto: nada a montar
    try {
      const nec = basicosDaBuild(META.champAtual);
      const tenho = {};
      const bag = scanBag(true);          // força a releitura: a mochila muda entre abates
      for (const i of ((bag && bag.items) || [])) {
        if (i.kind !== 'item' || !i.base) continue;
        tenho[String(i.base)] = (tenho[String(i.base)] || 0) + 1;
      }
      let faltam = 0;
      for (const id of Object.keys(nec)) faltam += Math.max(0, nec[id] - (tenho[id] || 0));
      return faltam;
    } catch { return 0; }
  }
  /** CLICA no filtro de básicos do jogo quando o critério B dá 0 (TK-02-27).
   *  MECÂNICA LIDA (não adivinhada): o ÚNICO writer do estado é o listener de `change`
   *  do jogo (jogo.js:5883-5886) — escrever `.checked` NÃO actualiza `estado.ignorarBasicos`.
   *  Logo: CLICAR (o browser dispara o change sozinho) e NUNCA escrever `.checked`.
   *  Efeito de ligar, lido no motor: motor.js:1794 `if (estado.ignorarBasicos &&
   *  raridade(infoItem(id)) === 'basico') continue;` — o básico é descartado DEPOIS do
   *  sorteio (não mexe em espólios/gemas/ouro/XP e corta também o básico de chefe).
   *  Verificação (a do próprio jogo): `document.querySelector('#ignorar-basicos').checked`. */
  async function clicarIgnorarBasicos() {
    const el = document.querySelector('#ignorar-basicos');
    if (!el) return { ok: false, motivo: 'sem checkbox no ecra' };
    if (el.checked) return { ok: false, motivo: 'ja ligado' };
    const B = folhasDeReceitaFaltando();
    if (B > 0) return { ok: false, motivo: 'faltam folhas de receita', B };
    el.click();                                   // dispara o change do jogo — nunca .checked
    const ligou = !!el.checked;
    logEvent('filtro-basicos', { B, clicado: true, ligou });
    return { ok: true, B, ligou };
  }
  /** BÁSICOS necessários p/ montar a build ideal (expande `de` recursivamente até a folha). */
  function basicosDaBuild(champ) {
    const byId = new Map((META.itens || []).map((i) => [String(i.id), i]));
    const nec = {};
    const exp = (id) => {
      const it = byId.get(String(id));
      if (!it) return;
      const de = it.de || [];
      if (!de.length) { nec[id] = (nec[id] || 0) + 1; return; }   // folha = básico de verdade
      for (const c of de) exp(c);
    };
    for (const id of buildIdealPara(champ)) exp(id);
    return nec;
  }

  /** PLANO só dos ITENS (espólio trata junto ao vender épico no lojista). */
  /** O mercado está saturado? = minhas ofertas têm 10 LENDÁRIOS (regra do dono). */
  function mercadoSaturado() {
    try {
      const of = ofertasEmCache() || [];
      const lend = of.filter((o) => String(o.raridade || '').toLowerCase().startsWith('lend')).length;
      return { sat: lend >= 10, lend, total: of.length };
    } catch { return { sat: false, lend: 0, total: 0 }; }
  }

  function planBag(bag, marketCount = 10, marketCap = 10) {
    const acts = [];
    const itens = bag.items.filter((i) => i.kind === 'item');
    const espolios = bag.items.filter((i) => i.kind === 'espolio');
    const ident = identidadeCampeao();
    // O PLANEADOR passa a saber EQUIPAR (era a regra que FALTAVA — docs/itens-ideal.md D7).
    // `planoEquipar` é a MESMA função que o actor `equiparMelhores` usa: planeador e actor
    // nunca podem discordar (era essa discordância que prendia o Tiamat na mochila, D16).
    const equiparPend = planoEquipar(bag);
    const equiparIds = equiparPend.ids;
    const equiparBases = equiparPend.bases || new Set();
    const equiparJaPosto = new Set();   // só UMA cópia de cada base vai para EQUIPAR; as outras são duplicados

    // ---- ÉPICOS: no máximo 1 de cada BASE, sempre o MAIOR tier. Acima de A: não se mexe.
    const porBase = {};
    for (const it of itens) if (it.raridade === 'epico') (porBase[it.base] = porBase[it.base] || []).push(it);
    const duplicado = new Set();
    for (const base in porBase) {
      const arr = porBase[base].slice().sort((a, b) => tierDe(b) - tierDe(a));
      for (let i = 1; i < arr.length; i++) if (qIdx(arr[i].qual) < qIdx('A')) duplicado.add(arr[i]);   // A/S/SS = intocável
    }

    // ---- LENDÁRIOS <A: também no máximo 1 por BASE (o melhor vai pro mercado, o resto é lixo).
    const lendPorBase = {};
    for (const it of itens) if (it.raridade === 'lendario') (lendPorBase[it.base] = lendPorBase[it.base] || []).push(it);
    for (const base in lendPorBase) {
      const arr = lendPorBase[base].slice().sort((a, b) => tierDe(b) - tierDe(a));
      for (let i = 1; i < arr.length; i++) if (qIdx(arr[i].qual) < qIdx('A')) duplicado.add(arr[i]);
    }

    // ---- BÁSICOS: guarda só o NECESSÁRIO p/ MONTAR a build ideal (receita `de` do motor) — o resto vai pro Lojista
    const necBas = basicosDaBuild(META.champAtual);
    const basPorBase = {};
    for (const it of itens) if (it.raridade === 'basico') (basPorBase[it.base] = basPorBase[it.base] || []).push(it);
    const basExcesso = new Set();
    for (const base in basPorBase) {
      const arr = basPorBase[base].slice().sort((a, b) => tierDe(b) - tierDe(a));
      const teto = necBas[base] || 0;   // 0 = não serve p/ a build → vende tudo (abaixo de A)
      let guardados = 0;
      for (const it of arr) {
        // SÓ S/SS é intocável (regra do dono: "a nao ser q seja tier s mais"). Antes o corte
        // era em A, e isso fazia o EXCEDENTE de qualidade A de um componente nunca ser vendido.
        if (qIdx(it.qual) >= qIdx('S')) continue;
        if (guardados < teto) { guardados++; continue; }              // guarda p/ a receita
        basExcesso.add(it);
      }
    }

    for (const it of itens) {
      if (it.raridade === 'lendario' && ehLendarioDaBuild(it.base)) acts.push({ action: 'PROTEGER', it, why: `LENDÁRIO DA BUILD DA CLASSE (${ident.perfil}/${ident.classe}) — nem mercado, nem Lojista` });
      else if (!QUAL.includes(it.qual)) acts.push({ action: 'PROTEGER', it, why: "qualidade '?' sendo avaliada — nunca mexer" });
      else if (it.raridade === 'lendario' && acimaDeA(it)) acts.push({ action: 'PROTEGER', it, why: 'lendário A/S/SS — nunca mexer' });
      // ALINHADO com o `venderBase` (que agora só protege S+): antes mandava épico A+ para o cofre
      // enquanto o ator podia vendê-lo — risco de venda não intencional.
      else if (it.raridade === 'epico' && qIdx(it.qual) >= qIdx('S')) acts.push({ action: 'GUARDAR_COFRE', it, why: `épico ${it.qual} (S+) — só pro cofre` });
      // ============ REGRA DO DONO (verbatim, 2026-10-14) ============
      // "item basico, epico, duplicado: vende no lojista. a nao ser q seja tier s mais."
      // As excepções S+ já estão tratadas ACIMA (lendário A/S/SS -> PROTEGER; épico A/S/SS
      // -> GUARDAR_COFRE). Aqui: básico, épico e duplicado vão TODOS para o Lojista.
      //
      // BUG QUE ISTO CORRIGE (medido): os básicos de qualidade A caíam no `else` final
      // ("sem regra" -> GUARDAR) porque `basExcesso` só apanha básicos SEM uso na build e
      // o `isTrash` só apanha ÉPICOS. Resultado: 1028~A x5, 1001~A x2, 1036~A x2 e mais
      // acumulavam-se na mochila para sempre — o dono viu-os e apontou-os.
      //
      // O `ANUNCIAR_MERCADO` foi REMOVIDO: o dono nunca autorizou vender no mercado —
      // a regra dele é "no Lojista". (Era herança do desenho original da extensão.)
      // LENDÁRIO < A: mantém-se a via antiga (mercado/saturado). A regra do dono só fala em
      // "básico, épico, duplicado" — lendário NÃO está na lista, e eu não vou decidir por ele.
      // FICA PERGUNTA ABERTA ao dono: lendário <A vai ao mercado ou ao Lojista?
      // ORDEM RESTAURADA (o teste T3 exige o motivo exacto da duplicata, e a regra genérica
      // do dono apanha-a primeiro). A regra do dono entra como um ramo PRÓPRIO, só para básico,
      // e o guard de componentes da build fica onde estava (reconciliação planeador↔ator:
      // sem ele o `n.vender` fica true para sempre e volta o PING-PONG Fonte<->campo).
      // S+ NUNCA SE VENDE, EM QUALQUER RARIDADE (regra do dono: "a nao ser q seja tier s mais").
      // A cadeia acima só protegia LENDÁRIO A/S/SS e ÉPICO S+ — um BÁSICO S/SS caía aqui e era
      // vendido. Esta linha fecha isso (e o jogo concorda: jogo.js:5515).
      // ---- ITENS DE PRIORIDADE EXTREMA (PRIORIDADE_EXTREMA, automation.js:47) ----
      // Regra do dono (2026-10-14, verbatim): "quais itens sao de extrema prioridade e que nao
      // devem ser tocados pelas nossas regras de auto clean, tipo gume do infinito e rabaddon.
      // mesmo duplicados, e o jogador que decide com eles." -> os multiplicadores de classe
      // (3031 motor.js:515 e 3089 motor.js:522) NUNCA se vendem nem se anunciam, NEM DUPLICADOS.
      // Isto SUBSTITUI a guarda solta que existia só para o Rabadon (e que o teste T10 exigia):
      // o Rabadon passa a ser um caso da regra, com o comportamento dele INTACTO, e o Gume do
      // Infinito ganha a mesma protecção. Vem ANTES de todos os ramos de venda (incluindo a
      // duplicata) e depois das protecções por raridade/qualidade, para não lhes roubar o motivo.
      else if (ehPrioridadeExtrema(it.base)) { const e = prioExtremaDe(it.base); acts.push({ action: 'PROTEGER', it, why: `PRIORIDADE EXTREMA (${e.classe}/${e.tipo}) — ${e.motivo} [${e.fonte}]: nunca se vende nem se anuncia, nem duplicado` }); }
      else if (qIdx(it.qual) >= qIdx('S')) acts.push({ action: 'PROTEGER', it, why: `tier ${it.qual} — S+ nunca se vende (regra do dono)` });
      // ---- TRATAMENTO ESPECIAL POR CAMPEÃO (ver ITENS_ESPECIAIS) ----
      // Um item especial DA MINHA CLASSE é intocável: o motor gasta-o em mim (ex.: Gume do
      // Infinito +40% no crítico, motor.js:515; Rabadon +35% AP, motor.js:522). O motivo e o
      // file:linha saem do mapa, para o log dizer PORQUE e não só "protegido".
      else if (ehEspecialMeu(it.base)) { const e = especialDe(it.base); acts.push({ action: 'PROTEGER', it, why: `tratamento especial (${e.papel}/${e.tipo}) para ${ident.perfil}/${ident.classe}: ${e.motivo} [${e.fonte}]` }); }
      // ---- REGRA DURA DO DONO: "um épico equipável NUNCA pode ficar na mochila com um básico
      // equipado". Isto é a acção EQUIPAR, e vem ANTES de qualquer ramo de venda: um épico que
      // desloca um equipado de degrau INFERIOR não é lixo, é upgrade. (Antes, sem esta linha, o
      // épico caía no ramo "épico → Lojista" ou em "GUARDAR componente" e ficava PRESO — D16.)
      // SÓ UMA cópia por base: o `id` do slot ('1006~A') repete-se em duplicados, e casar por `id`
      // marcava TODAS as cópias como EQUIPAR (nenhuma era vendida). A 2.ª cópia cai nos ramos
      // seguintes (duplicado -> Lojista), que é a regra do dono.
      else if ((equiparIds.has(it.id) || equiparBases.has(String(it.base))) && !equiparJaPosto.has(String(it.base))) { equiparJaPosto.add(String(it.base)); acts.push({ action: 'EQUIPAR', it, why: `melhor disponível para o slot (${it.raridade} ${it.qual}${it.refino ? ' +' + it.refino : ''}) — desloca equipado de degrau inferior` }); }
      // ---- PEÇAS RESERVADAS (as DUAS builds: mob × chefe) ---------------------------------
      // PEDIDO DO DONO: "o que sai fica na MOCHILA e NUNCA e vendido (sao as pecas da outra
      // build)". A troca por fase despe a build que não está em uso; se estas peças fossem
      // vendidas, a build da outra fase desaparecia. Vem DEPOIS do EQUIPAR (um reservado que
      // é o melhor do slot ainda é vestido) e ANTES de qualquer ramo de venda.
      else if (ehReservado(it.base)) { const fsR = fasesDoItem(it.base); acts.push({ action: 'PROTEGER', it, why: 'peça da build de ' + (fsR.length ? fsR.join(' + ') : 'fase') + ' — RESERVADA para a troca por fase (não se vende nem se anuncia)' }); }
      // BÁSICO que NÃO serve a build -> Lojista (regra do dono: "basico ... vende no lojista").
      else if (it.raridade === 'basico' && !componentesDaBuild().has(String(it.base))) acts.push({ action: 'VENDER_LOJISTA', it, why: 'regra do dono: básico → Lojista (não serve a build)' });
      // BÁSICO COMPONENTE DA BUILD: GUARDA até ao número que a RECEITA pede (`basicosDaBuild`
      // expande os `de` do motor até às folhas); só o EXCEDENTE vai ao Lojista. Vender a
      // matéria-prima foi o erro que deixou o campeão com ZERO Adagas e nenhuma receita do Ornn
      // a arrancar (o `basExcesso` já existia mas era CÓDIGO MORTO — o ramo "básico -> Lojista"
      // vinha antes dele e vendia tudo, ver docs/itens-ideal.md §2.2).
      else if (it.raridade === 'basico' && basExcesso.has(it)) acts.push({ action: 'VENDER_LOJISTA', it, why: `básico em EXCESSO (a build precisa de ${necBas[it.base] || 0})` });
      // REGRA DO DONO (2026-10-14, verbatim): "eu nao mandei nunca montar itens. e sempre comprar
      // do mercado." -> NAO se guarda materia-prima para receita. Basico inutil vai ao Lojista.
      // (Antes: `basico COMPONENTE da build -> GUARDAR`, que enchia a mochila com pecas para
      //  montar algo que nunca se vai montar.)
      else if (it.raridade === 'basico') acts.push({ action: 'VENDER_LOJISTA', it, why: 'básico → Lojista (regra do dono: nunca se monta)' });
      // REGRA DO DONO (2026-10-14, verbatim): "eu nao mandei nunca montar itens. e sempre comprar do mercado."
      // -> TODO epico vai ao Lojista. A excepcao 'e componente da build' foi REMOVIDA: era ela que
      // prendia um epico A na mochila, inclusive para montar um lendario QUE JA ESTAVA EQUIPADO.
      // MEDIDO AO VIVO (Lead, 2026-10-14): o epico `3108~A` continuava a sair `GUARDAR` no planBag
      // — nao caia aqui (por causa do guard de componentes, que o tirava deste ramo) e o ramo que o
      // guardava ja tinha sido removido, logo so podia cair no `else` final ('sem regra' -> GUARDAR).
      // O ramo `isTrash(it)` que existia a seguir ficou MORTO com isto (o `isTrash` so apanha
      // epicos, e TODOS os epicos passam por aqui) e foi removido: deixar codigo inalcancavel
      // esconderia a regra real. `isTrash` continua vivo noutro consumidor (`infoItem`, o
      // `lixo:` do painel).
      else if (it.raridade === 'epico') acts.push({ action: 'VENDER_LOJISTA', it, why: 'regra do dono: épico → Lojista' });
      // DUPLICATA por RARIDADE (regra do dono, verbatim): "a liandry c e anunciada no mercado...
      // e fica a liandry a. se eu tenho outra liandry a, (duas), anuncia uma delas no mercado."
      // -> LENDARIO duplicado vai ao MERCADO; basico/epico duplicado vai ao Lojista.
      else if (duplicado.has(it)) acts.push(it.raridade === 'lendario'
        ? (mercadoSaturado().sat
          ? { action: 'PROTEGER', it, why: 'duplicata de lendário — mercado SATURADO: fica na mochila (lendário NUNCA vai ao Lojista)' }
          : { action: 'ANUNCIAR_MERCADO', it, why: 'duplicata de lendário (fica a de maior tier) → mercado' })
        : { action: 'VENDER_LOJISTA', it, why: 'duplicata (fica 1, o de maior tier)' });
      // LENDÁRIO < A: via antiga (mercado/saturado), DEPOIS da duplicata — é a ordem original
      // e o teste T3 depende dela (a duplicata tem de ser apanhada primeiro).
      // REGRA DO DONO (2026-10-14, verbatim): "lendarios sao desejados pelos jogadores, entao nunca
      // se vende lendario pelo lojista, so pelo mercado". -> um LENDÁRIO NUNCA cai no ramo do
      // Lojista, nem quando o mercado está saturado (antes: `ms.sat ? VENDER_LOJISTA : mercado`).
      // A saturação só decide SE anuncia agora; se não puder anunciar, o item FICA na mochila.
      else if (it.raridade === 'lendario') { const ms = mercadoSaturado(); acts.push(ms.sat
        ? { action: 'PROTEGER', it, why: 'lendário < A — mercado SATURADO: fica na mochila (lendário NUNCA vai ao Lojista, regra do dono)' }
        : { action: 'ANUNCIAR_MERCADO', it, why: 'lendário < A → mercado (lendário nunca vai ao Lojista)' }); }
      else acts.push({ action: 'GUARDAR', it, why: 'sem regra' });
    }

    // excesso de espaço: prioridade de descarte
    const excesso = bag.used - bag.cap;
    if (excesso > 0) {
      const ordem = ['VENDER_LOJISTA', 'GUARDAR', 'ANUNCIAR_MERCADO'];
      let falta = excesso;
      for (const act of ordem) {
        if (falta <= 0) break;
        for (const a of acts) {
          if (falta <= 0) break;
          if (a.action !== act || a.evicted) continue;
          a.evicted = true; falta--;
          // TRANSBORDO: quando a mochila passa da capacidade, o MATERIAL BÁSICO em excesso passa
          // a VENDER_LOJISTA. Sem isto, uma mochila cheia de componentes protegidos deixava o
          // `n.vender` falso para sempre (nada vendável) e o loot parava. Os ÉPICOS componentes
          // continuam guardados (valem ouro a sério).
          // TRANSBORDO: o mercado cheio rebaixava o anúncio para o LOJISTA — proibido para
          // LENDÁRIO (regra do dono: "nunca se vende lendario pelo lojista, so pelo mercado").
          // Um lendário sem vaga no mercado fica na mochila (PROTEGER).
          if (a.action === 'ANUNCIAR_MERCADO') a.action = a.it.raridade === 'lendario' ? 'PROTEGER' : (marketCount >= marketCap ? 'VENDER_LOJISTA' : 'ANUNCIAR_MERCADO');
          else if (a.action === 'GUARDAR' && a.it.raridade === 'basico') a.action = 'VENDER_LOJISTA';
        }
      }
    }
    return { acts, espolios, excesso };
  }

  /** Mínimo de poções ESCALA com o ouro: pobre = mínimo baixo; rico = estoque grande. */
  function minimoPocoes() {
    const o = readGold();
    const esc = o >= 300000 ? 1 : o >= 80000 ? 0.5 : o >= 20000 ? 0.25 : 0.1;
    const m = (v, piso) => Math.max(piso, Math.round((v || 0) * esc));
    return { vida: m(cfg.minPotion.vida, 5), vidaF: m(cfg.minPotion.vidaF, 3), vidaS: m(cfg.minPotion.vidaS, 1) };
  }
  /** MÍNIMO SÓ DAS POÇÕES QUE A LOJA VENDE AO NÍVEL DELE. O `cfg.minPotion.vidaS: 30` continua a
   *  ser o stock DESEJADO, mas enquanto a loja não vender a Suprema (nível 30, motor.js:264) o
   *  mínimo dela é ZERO — senão `repor` fica verdadeiro PARA SEMPRE e o boneco entra no ciclo
   *  "volta à base -> não consegue comprar -> sai -> volta 20 s depois" (P0 medido ao vivo). */
  function minimoPocoesAgora() {
    const m = minimoPocoes();
    const out = {};
    for (const k of Object.keys(m)) out[k] = pocaoCompravel(k) ? m[k] : 0;
    return out;
  }

  function planPotions(pot) {
    const min = minimoPocoesAgora();
    const faltas = [];
    for (const k of ['vida', 'vidaF', 'vidaS']) if (numOr(pot[k], 0) < min[k] && pocaoCompravel(k)) faltas.push(k);
    if (!faltas.length) return null;
    // comprar da mais cara pra mais barata; ORÇAMENTO = no máx 40% do ouro (o resto é pra ITEM)
    const ordem = ['vidaS', 'vidaF', 'vida'];
    const preco = PRECO_POCAO;
    let ouro = Math.floor(readGold() * 0.4);
    const comprar = {};
    for (const k of ordem) {
      const q = Math.max(0, Math.min(cfg.buyPotion[k] || 0, min[k] - numOr(pot[k], 0)));
      const custo = q * preco[k];
      if (custo <= ouro) { comprar[k] = q; ouro -= custo; }
      else { comprar[k] = Math.max(0, Math.floor(ouro / preco[k])); ouro -= comprar[k] * preco[k]; }
    }
    return { faltas, comprar, min };
  }

  // ------------------------------------------------------------- farm (aba Servidor = #log)
  const FARM_KEY = STORAGE_KEY + ':farm';
  const seenLog = new WeakSet();
  let farm = { current: null, cycles: [], log: [], issues: [], deaths: [] };

  const parseBig = (s) => { if (!s) return null; const m = String(s).match(/([\d.,]+)\s*([kKmM])?/); if (!m) return null; const v = parseNum(m[1], m[2]); return Number.isFinite(v) ? Math.round(v) : null; };
  function logEvent(type, data) { try { farm.log = [{ at: Date.now(), type, ...data }, ...(farm.log || [])].slice(0, 200); } catch { /* ignore */ } }
  function logIssue(type, data) { try { farm.issues = [{ at: Date.now(), type, ...data }, ...(farm.issues || [])].slice(0, 100); } catch { /* ignore */ } }

  const PRECO_POCAO = { get vida() { return pocaoInfo('vida').preco; }, get vidaF() { return pocaoInfo('vidaF').preco; }, get vidaS() { return pocaoInfo('vidaS').preco; } };
  const lootTimes = [];
  const killTimes = [];
  /** Larvas que o Barao invocou, com a data (motor.js:3141-3142). Contam como ABATES para a
   *  Voracidade (motor.js:1811, sem guarda `i.invocado`) mas nao dao loot (motor.js:1792),
   *  logo nao aparecem no log do jogo — tem de as contar aqui (TK-02-148).
   *  Formato: [{ at: ms, n: 2 }] (2 larvas por invocacao). */
  const _larvasInvoca = [];
  /** TK-02-148: leitura publica (o banco chama `auto.larvasInvoca()`). */
  function larvasInvoca() { return _larvasInvoca.slice(); }
  /** Janela das larvas invocadas (ms): 90 s = 2,6 voltas do rodizio do Barao (34,3 s,
   *  motor.js:3080/:3099/:3103). O que passa dela ja nao conta para a cadencia AGORA. */
  const LARVAS_JANELA_MS = 90000;
  let ultimoFurioso = 0;
  /** Contexto atual pela wave: boss > furioso > nº de mobs mortos nos últimos 5s. */
  function contexto(now, boss) {
    while (lootTimes.length && now - lootTimes[0] > 5000) lootTimes.shift();
    if (boss) return 'chefe';
    if (now - ultimoFurioso < 15000) return 'furioso';
    return 'mob' + Math.min(4, Math.max(1, lootTimes.length));
  }
  function novaFase(now) { return { startedAt: now, gold: 0, xp: 0, dmg: 0, heal: 0, kills: 0, potions: 0, potUsed: { vida: 0, vidaF: 0, vidaS: 0 }, hpMin: null, hpMax: null, hpSum: 0, hpN: 0 }; }

  /** Estrutura das waves: separa o gap INTRA-wave (mobs chegando em tempos diferentes)
   *  do gap ENTRE waves. Dá o tamanho da wave, o stagger e o kills/min real. */
  function analisarWaves() {
    const t = killTimes.slice();
    if (t.length < 3) return { n: t.length };
    const gaps = [];
    for (let i = 1; i < t.length; i++) gaps.push(t[i] - t[i - 1]);
    const sorted = [...gaps].sort((a, b) => a - b);
    const med = sorted[Math.floor(sorted.length / 2)];
    let best = 0, cut = sorted.length - 1;
    for (let i = Math.floor(sorted.length * 0.4); i < sorted.length - 1; i++) {
      const r = sorted[i + 1] / Math.max(1, sorted[i]);
      if (r > best) { best = r; cut = i; }
    }
    const thr = Math.max(med * 1.8, (sorted[cut] + sorted[cut + 1]) / 2);
    const intra = gaps.filter((g) => g < thr), inter = gaps.filter((g) => g >= thr);
    const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : null);
    const waves = inter.length + 1;
    const span = t[t.length - 1] - t[0];
    return { n: t.length, waves, perWave: +(t.length / waves).toFixed(2), killsMin: span > 0 ? +((t.length - 1) / (span / 60000)).toFixed(1) : null, intraMs: intra.length ? Math.round(mean(intra)) : null, interMs: inter.length ? Math.round(mean(inter)) : null, medGapMs: med, thrMs: Math.round(thr), spanS: Math.round(span / 1000) };
  }

  /** Ritmo dos mobs: tempo por wave e tempo de 3 waves (base p/ decidir a ultimate). */
  let _ritmoEmCurso = false;
  let _ritmoReentradas = 0;
  function ritmoMobs() {
    // GUARDA DE RE-ENTRÂNCIA (2026-10-18): `ritmoMobs` fecha o ciclo
    //   ... -> killsMinAoVivo -> ritmoMobs -> agregar -> curaGiroS -> ... -> killsMinAoVivo -> ritmoMobs
    // A guarda do `agregar` já corta o ciclo; esta é a segunda porta. Devolve `null` = "sem medida"
    // (nunca se inventa um ritmo).
    if (_ritmoEmCurso) { _ritmoReentradas++; return null; }
    _ritmoEmCurso = true;
    try { return _ritmoMobsCorpo(); } finally { _ritmoEmCurso = false; }
  }
  function _ritmoMobsCorpo() {
    const aw = analisarWaves();
    // B2 (TK-01-08): mobs/wave é a MÉDIA do motor (`mediaWaveDe`, motor.js:1137), NÃO a `base` (o MÍNIMO).
    // A versão antiga usava a base e deixava o `seg3` 33% baixo — a ultimate nunca saía nos mobs.
    const perWave = mediaWaveDe(META.grupoSpawn) || (aw && aw.perWave) || 3;
    // A taxa aceita a MEDIDA (agregar/perMin) além da janela do #log: sem isto, um mundo com kills
    // medidos mas poucos abates no log devolvia null e o ritmo desaparecia.
    // NAO usar `killsMinAoVivo()` aqui: ele chama o `ritmoMobs` de volta (recursao). Ler a MEDIDA directa.
    const km = (aw && aw.killsMin) || (() => { try { for (const a of (agregar() || [])) if (a.killsMin) return a.killsMin; } catch { /* ignore */ } return null; })();
    if (!(km > 0)) return null;
    const gapS = (aw && aw.medGapMs) ? aw.medGapMs / 1000 : (perWave / km) * 60;
    if (!gapS) return null;
    const segPorWave = +(perWave * gapS).toFixed(1);
    return { n: (aw && aw.n) || 0, waves: (aw && aw.waves) || 1, perWave, killsMin: km, segPorWave, seg3: +(segPorWave * 3).toFixed(1), intraMs: aw.intraMs, interMs: aw.interMs, medGapMs: aw.medGapMs };
  }
  /** Vale usar a ultimate (skill de CD longo > 35s) nos mobs? Sim se 3 waves DEMORAM p/ morrer.
   *  Se vale, é sinal FORTE de que o chefe da área não é vencível — mas NÃO é o único critério. */
  function valeUlt() {
    const r = ritmoMobs();
    if (!r || r.seg3 == null) return false;
    return r.seg3 > (cfg.ultWaveSeg || 12);
  }

  // FIX: lia window.__lolidleRunLog, que NUNCA e escrita em lado nenhum -> o log
  // aparecia sempre VAZIO e escondia toda a actividade real (logEvent escreve em farm.log).
  const getRunLog = () => (farm.log || []).slice();
  /** Analisa a run: bursts de dano, abates, waves e os gaps — pra achar o gargalo real. */
  function analisarRun() {
    const log = getRunLog();
    if (log.length < 5) return { n: log.length };
    const dmgs = log.filter((e) => e.t === 'dmg');
    const kills = log.filter((e) => e.t === 'kill');
    const waves = log.filter((e) => e.t === 'wave');
    const bursts = [];
    for (const d of dmgs) {
      const last = bursts[bursts.length - 1];
      if (!last || d.at - last.fim > 500) bursts.push({ ini: d.at, fim: d.at, n: 1, soma: d.v });
      else { last.fim = d.at; last.n++; last.soma += d.v; }
    }
    const gaps = []; for (let i = 1; i < bursts.length; i++) gaps.push(bursts[i].ini - bursts[i - 1].fim);
    const kg = []; for (let i = 1; i < kills.length; i++) kg.push(kills[i].at - kills[i - 1].at);
    const med = (a) => (a.length ? a.slice().sort((x, y) => x - y)[Math.floor(a.length / 2)] : null);
    const burstSomaMed = bursts.length ? Math.round(bursts.reduce((s, b) => s + b.soma, 0) / bursts.length) : null;
    // limite: se o burst médio cobre o HP do mob, é 1-shot → spawn-limitado; senão é DPS-limitado
    let mobHp = null, limite = null, umHit = null;
    try { const lid = localId(readLocation().text); if (lid) { const e = estimarRegiao(lid); if (e) { mobHp = e.mobHp; umHit = burstSomaMed != null ? burstSomaMed >= mobHp : null; limite = umHit == null ? null : umHit ? 'spawn' : 'dps'; } } } catch { /* ignore */ }
    return {
      n: log.length, dmgs: dmgs.length, kills: kills.length, waves: waves.length, bursts: bursts.length,
      danoTotal: dmgs.reduce((s, d) => s + d.v, 0),
      burstSomaMed, mobHp, umHit, limite,
      burstHitsMed: bursts.length ? +(bursts.reduce((s, b) => s + b.n, 0) / bursts.length).toFixed(1) : null,
      gapBurstMedMs: med(gaps), killGapMedMs: med(kg),
      killGaps: kg.slice(-24), burstGaps: gaps.slice(-24),
      wavesNomes: waves.slice(-8).map((w) => w.nome),
    };
  }
  function fechaFase(f, endAt) {
    if (!f) return f;
    f.endedAt = endAt; f.durMs = Math.max(1, endAt - f.startedAt);
    f.hpAvg = f.hpN ? f.hpSum / f.hpN : null;
    if (f.ctx) { f.ctxS = {}; for (const k of Object.keys(f.ctx)) { const c = f.ctx[k]; if (c.t > 0.5) f.ctxS[k] = { healS: (c.heal - (c.potion || 0)) / c.t, dmgS: c.dmg / c.t, t: c.t }; } }
    f.goldPotion = f.potUsed.vida * PRECO_POCAO.vida + f.potUsed.vidaF * PRECO_POCAO.vidaF + f.potUsed.vidaS * PRECO_POCAO.vidaS;
    f.healPotion = f.potUsed.vida * HEALVAL.vida + f.potUsed.vidaF * HEALVAL.vidaF + f.potUsed.vidaS * HEALVAL.vidaS;
    f.healSkill = Math.max(0, (f.heal || 0) - f.healPotion);   // cura do personagem SEM poção (≥0; poção pode ter overheal)
    const min = f.durMs / 60000;
    f.perMin = { gold: f.gold / min, xp: f.xp / min, dmg: f.dmg / min, heal: f.heal / min, healSkill: f.healSkill / min, healPotion: f.healPotion / min, potions: f.potions / min, goldPotion: f.goldPotion / min, kills: f.kills / min };
    if (f.kills > 0) f.perKill = { gold: f.gold / f.kills, xp: f.xp / f.kills };
    return f;
  }
  /** Setup completo da run (skills na barra, itens, stats, poções, ouro). */
  function snapshotSetup() {
    const sk = readSkills();
    return { at: Date.now(), bar: sk.bar, arsenal: sk.arsenal, equip: readEquip(), stats: readStats(), player: player(), potions: readPotions(), gold: readGold() };
  }
  function novoCiclo(region, now) { return { region, startedAt: now, janela: (typeof window !== 'undefined' && (window.__lolidleJanela = window.__lolidleJanela || Date.now())) || 0, fase: 'mobs', mobFase: novaFase(now), bossFase: null, gold: 0, xp: 0, boss: null, setup: snapshotSetup() }; }

  /** Lê os marcadores do mapa (abre/fecha o mapa se preciso). */
  function readMap() {
    const win = document.querySelector('#janela-mapa');
    const tinha = !!document.querySelector('#marcadores .marcador[data-local]');
    const wasOpen = win && !win.hidden;
    if (!tinha) press('m');
    const marks = [...document.querySelectorAll('#marcadores .marcador[data-local]')].map((b) => {
      const r = (b.textContent || '').match(/(\d+)\s*[–-]\s*(\d+)/);
      return {
        id: b.dataset.local,
        name: (b.querySelector('.mk-nome')?.textContent || '').trim(),
        range: r ? [+r[1], +r[2]] : null,
        ideal: b.classList.contains('ideal'),
        atual: b.classList.contains('atual'),
        escolhido: b.classList.contains('escolhido'),
      };
    });
    if (!tinha && !wasOpen) press('m'); // fecha de volta se fui eu que abri
    return marks;
  }

  let _ultimoKillMs = 0;
  function handleLog(entry) {
    const loc = readLocation();
    const naBase = () => /fonte/i.test(loc.text);   // era um BOOLEANO e era CHAMADO como funcao (naBase()) em 4 sitios -> TypeError
    // migra ciclo antigo (sem fases) vindo do storage
    if (farm.current && !farm.current.mobFase) { farm.current.fase = 'mobs'; farm.current.mobFase = novaFase(farm.current.startedAt || Date.now()); }
    // ciclo começa quando estamos numa região
    if (!farm.current && !naBase) farm.current = novoCiclo(loc.text, Date.now());
    // viajou/trocou de região: fecha o ciclo anterior e recomeça com a região certa
    if (farm.current && farm.current.region !== loc.text) {
      const old = farm.current;
      fechaFase(old.fase === 'boss' ? old.bossFase : old.mobFase, Date.now());
      old.fim = (old.deaths > 0) ? 'morte' : 'viagem';
      old.incompleto = old.fim !== 'chefe';
      old.endedAt = Date.now(); old.durMs = old.endedAt - old.startedAt;
      if (old.boss) registrarLuta(old);
      // NAO guardar ciclos VAZIOS (0 ouro, 0 xp, 0 abates, sem chefe). Nao têm
      // informação sobre o desempenho e ENVENENAM o previsor empírico: medido,
      // 24 ciclos a zeros de Toca dos Lobos faziam qualquer build ali parecer
      // péssima — e é esse histórico que decide a melhor build (M1).
      const teveDados = (old.gold || 0) > 0 || (old.xp || 0) > 0 || (old.mobFase && old.mobFase.kills > 0) || !!old.boss;
      if (teveDados) { farm.cycles.unshift(old); farm.cycles = farm.cycles.slice(0, 30); }
      else logEvent('ciclo-vazio', { region: old.region, fim: old.fim, durMs: old.durMs });
      farm.current = naBase ? null : novoCiclo(loc.text, Date.now());
      publishFarm();
    }
    // C (TK-01-07): a CAÇA OFFLINE nao e abate — registada e o bloco do abate fica no `else`
    // (NAO usar `return`: o handleLog tem seccoes seguintes — chefe, etc.).
    if (/Enquanto voce estava fora|Enquanto você estava fora/i.test(entry.body)) {
      const xo = entry.body.match(/\+\s*([\d.,]+\s*[kKmM]?)\s*de experi/i);
      const oo = entry.body.match(/\+\s*([\d.,]+\s*[kKmM]?)\s*de ouro/i);
      logEvent('caca-offline', { xp: xo ? parseNum(xo[1]) : null, ouro: oo ? parseNum(oo[1]) : null });
      // O ESPIAO do banco (C) observa o caminho REAL: `window.__lolidleRlog` com os numeros ja parseados.
      if (window.__lolidleRlog) window.__lolidleRlog({ t: 'offline', xp: xo ? parseNum(xo[1]) : null, ouro: oo ? parseNum(oo[1]) : null });
    } else {
    const g = entry.body.match(/(?:Loot|recebeu)[^:]*:\s*(\d[\d.,]*\s*[kKmM]?)\s*de ouro/i);
    const x = entry.body.match(/\+\s*(\d[\d.,]*\s*[kKmM]?)\s*de experi/i);
    const nomeLoot = (entry.body.match(/Loot de\s+(.+?):/i) || [])[1] || null;
    if (g || x) {
      // B2: o abate conta por OURO **ou** XP (o killTimes so era alimentado no ramo do ouro —
      // um abate so-XP nao entrava no ritmo e o `ritmoMobs` devolvia null).
      // LOTE INICIAL: o `scanLog` do arranque processa o #log inteiro no MESMO milissegundo -> span=0 e a
      // medida do ritmo desaparecia. Abates no mesmo ms sao espacados 1 s (no jogo real sao segundos
      // apart, logo isto nao toca em nada); `_ultimoKillMs` guarda o ultimo carimbo.
      const _agoraKill = (() => { const n = Date.now(); return (n <= _ultimoKillMs) ? _ultimoKillMs + 1000 : n; })();
      _ultimoKillMs = _agoraKill;
      killTimes.push(_agoraKill); if (killTimes.length > 200) killTimes.shift();
      if (window.__lolidleRlog) window.__lolidleRlog({ t: 'kill', nome: nomeLoot, gold: g ? parseNum(g[1]) : null, xp: x ? parseNum(x[1]) : null });
      if (!farm.current && !naBase) farm.current = novoCiclo(loc.text, Date.now());
      if (farm.current) {
        const fase = farm.current.fase === 'boss' ? farm.current.bossFase : farm.current.mobFase;
        if (g) { const v = parseNum(g[1]); farm.current.gold += v; fase.gold += v; fase.kills += 1; lootTimes.push(Date.now()); if (lootTimes.length > 30) lootTimes.shift(); killTimes.push(Date.now()); if (killTimes.length > 200) killTimes.shift(); }
        if (x) { const v = parseNum(x[1]); farm.current.xp += v; fase.xp += v; }
      }
    }
    }
    const apChefe = entry.body.match(/Um chefe apareceu:\s*(.+?)[!.]?$/i);
    if (apChefe) {
      if (!farm.current && !naBase) farm.current = novoCiclo(loc.text, Date.now());
      if (farm.current) {
        const c = farm.current;
        if (!c.boss) { c.boss = apChefe[1].trim(); c.bossStart = Date.now(); }
        if (c.fase !== 'boss') { fechaFase(c.mobFase, Date.now()); c.fase = 'boss'; c.bossFase = novaFase(Date.now()); }
      }
    }
    const apFur = entry.body.match(/Um monstro furioso apareceu:/i);
    if (apFur && farm.current) { farm.current.furiosoApareceu = (farm.current.furiosoApareceu || 0) + 1; ultimoFurioso = Date.now(); }
    const dc = entry.body.match(/Você derrotou o monstro furioso \((.+?)\)/i);
    if (dc && farm.current) { farm.current.furioso = (farm.current.furioso || 0) + 1; farm.current.furiosoNome = dc[1]; }
    // morte: registra quem matou e o XP perdido (mesmo se o ciclo fechar depois)
    if (/Você está morto/i.test(entry.body)) {   // só morte DE VERDADE (cls do jogo é poluído: NPC/item caíam aqui)
      const by = entry.body.match(/derrotado por (.+?)\)/i)?.[1] || null;
      const lost = parseBig(entry.body.match(/Perdeu\s+([\d.,]+\s*[kKmM]?)\s+de experi/i)?.[1]);
      let recursos = null; try { recursos = snapshotEstado(); } catch { /* ignore */ }
      const live = (typeof window !== 'undefined' && window.__lolidleLive) || null;
      const hist = live?.hist ? live.hist.slice(-120) : null;   // REPLAY: hits/heals/poções/cargas até a morte
      const build = readEquip().map((e) => e.base + (e.refino ? '+' + e.refino : '') + (e.qual ? '~' + e.qual : ''));
      const morte = { at: Date.now(), by, xpLost: lost, region: loc.text, body: String(entry.body || '').slice(0, 220), pocoes: readPotions(), build, recursos, hist };
      farm.deaths = [morte, ...(farm.deaths || [])].slice(0, 50);
      logEvent('morte', { by, xpLost: lost, region: loc.text, recursos, build });
      if (farm.current) { farm.current.deaths = (farm.current.deaths || 0) + 1; farm.current.deathBy = by; farm.current.xpLost = (farm.current.xpLost || 0) + (lost || 0); }
    }
    if (entry.chefe && /foi derrotado/i.test(entry.body)) {
      const c = farm.current;
      if (c) {
        fechaFase(c.bossFase || c.mobFase, Date.now());
        c.bossDurMs = c.bossStart ? Date.now() - c.bossStart : null;
        c.fim = 'chefe';
        c.endedAt = Date.now(); c.durMs = c.endedAt - c.startedAt;
        farm.cycles.unshift(c);
        farm.cycles = farm.cycles.slice(0, 30);
        farm.current = null;
        registrarLuta(c);
        console.log('[LolidleAuto] ciclo', JSON.stringify({ regiao: c.region, chefe: c.boss, ouro: c.gold, xp: c.xp, mobOuroMin: Math.round(c.mobFase?.perMin?.gold || 0), mobXpMin: Math.round(c.mobFase?.perMin?.xp || 0), bossS: c.bossDurMs ? Math.round(c.bossDurMs / 1000) : null }));
        publishFarm();
      }
    }
    if (farm.current) publishFarm();
  }

  function scanLog() {
    const log = document.querySelector('#log');
    if (!log) return;
    for (const p of log.querySelectorAll('p')) {
      if (seenLog.has(p)) continue;
      seenLog.add(p);
      const t = (p.textContent || '').replace(/\s+/g, ' ').trim();
      handleLog({ body: t.replace(/^\d{1,2}:\d{2}\s*/, ''), chefe: p.classList.contains('chefe'), cls: String(p.className) });
    }
  }

  function publishFarm() {    try { chrome.storage.local.set({ [FARM_KEY]: { current: farm.current, cycles: farm.cycles, lutas: (farm.lutas || []).slice(0, 50), log: (farm.log || []).slice(0, 200), issues: (farm.issues || []).slice(0, 100), deaths: (farm.deaths || []).slice(0, 50) } }); } catch { /* ignore */ }
  }

  /** VALIDAÇÃO: compara a estimativa de luta (estimarLuta) com o que aconteceu de verdade. */
  /** Analisa a luta de chefe a partir do run log (números do canvas): DPS nosso, dano tomado, cura. */
  function analisarLutaBoss(t0, t1) {
    const live = (typeof window !== 'undefined' && window.__lolidleLive) || {};
    const dur = Math.max(0.5, (t1 - t0) / 1000);
    // DPS REAL = eventos do jogo (live.danoHist, amostras cumulativas). Fonte da verdade.
    const H = live.danoHist || [];
    const amostra = (t) => { let r = H.length ? H[0] : null; for (const s of H) { if (s.at <= t) r = s; else break; } return r; };
    const a = amostra(t0), b = amostra(t1);
    if (a && b && b !== a) {
      const out = Math.max(0, (b.out || 0) - (a.out || 0));
      const inc = Math.max(0, (b.in || 0) - (a.in || 0));
      const porFonte = {}; const bp = b.porSkill || {}, ap = a.porSkill || {};
      for (const f in bp) { const d = (bp[f] || 0) - (ap[f] || 0); if (d) porFonte[f] = Math.round(d / dur); }
      return { durS: +dur.toFixed(1), outDps: Math.round(out / dur), inDps: Math.round(inc / dur), dmgTotal: Math.round(out), dmgTomado: Math.round(inc), porFonte, fonte: 'eventos' };
    }
    // fallback (hook ainda não pegou): canvas
    const log = (typeof window !== 'undefined' && window.__lolidleRunLog) || [];
    let out = 0, inc = 0; const porCor = {};
    for (const e of log) { if (e.at < t0 || e.at > t1) continue; if (e.t === 'dmg') { if (e.dir === 'in') inc += e.v; else out += e.v; const c = e.cor || '?'; porCor[c] = (porCor[c] || 0) + e.v; } }
    return { durS: +dur.toFixed(1), outDps: Math.round(out / dur), inDps: Math.round(inc / dur), dmgTotal: Math.round(out), porCor, fonte: 'canvas' };
  }

  function registrarLuta(c) {
    if (!c || !c.boss) return;
    const id = localId(c.region);
    let est = null; try { est = id ? estimarLuta(id) : null; } catch { /* ignore */ }
    // cura de skills medida só na fase de chefe — pelos EVENTOS do jogo, com cura CAPADA tratada como cheia
    let healSkillS = null;
    try {
      const liveH = (typeof window !== 'undefined' && window.__lolidleLive) || null;
      const t0b = c.bossStart || c.bossFase?.startedAt || c.startedAt;
      const t1b = c.endedAt || Date.now();
      const maxHp = player().vida || 1;
      const evs = ((liveH && liveH.hist) || []).filter((e) => e.t === 'heal' && e.v != null && e.at >= (t0b || 0) && e.at <= t1b);
      const ded = []; let last = null;
      for (const e of evs) { if (last && e.v === last.v && e.at - last.at < 150) continue; ded.push(e); last = e; }   // tira o 4x do canvas
      const naoCapados = ded.filter((e) => !(e.hp != null && e.hp >= maxHp - 1)).map((e) => e.v);
      const ordenado = naoCapados.slice().sort((a, b) => a - b);
      let nominal = ordenado.length ? ordenado[Math.floor(ordenado.length / 2)] : null;   // MEDIANA (robusta a rolagem alta)
      if (nominal == null && est && est.curaSkill) nominal = est.curaSkill;               // todas capadas → fallback no teórico
      let total = 0;
      for (const e of ded) { const capado = e.hp != null && e.hp >= maxHp - 1; total += (capado && nominal != null && nominal > e.v) ? nominal : e.v; }
      const durB = Math.max(0.5, (t1b - (t0b || t1b)) / 1000);
      const potNominal = (c.bossFase?.potions || 0) * (typeof curaPocaoMax === 'function' ? curaPocaoMax() : 900);
      healSkillS = Math.max(0, Math.round((total - potNominal) / durB));
    } catch { /* ignore */ }
    const build = readEquip().map((e) => e.base + (e.refino ? '+' + e.refino : '') + (e.qual ? '~' + e.qual : ''));
    const skills = (() => { try { return readSkills().bar.map((h) => h.nome || h.t); } catch { return []; } })();
    const live = (typeof window !== 'undefined' && window.__lolidleLive) || null;
    const t0 = c.bossStart || c.bossFase?.startedAt || c.startedAt;
    const hist = live?.hist ? live.hist.filter((e) => e.at >= (t0 || 0)).slice(-300) : null;
    const real = {
      boss: c.boss, region: (c.region || '').replace(/ nível.*/, ''),
      durS: c.bossDurMs ? +(c.bossDurMs / 1000).toFixed(1) : (c.bossFase?.endedAt && c.bossFase?.startedAt ? +((c.bossFase.endedAt - c.bossFase.startedAt) / 1000).toFixed(1) : null),
      hpMin: c.bossFase?.hpMin ?? null, hpMinPct: c.bossFase?.hpMin != null ? Math.round((100 * c.bossFase.hpMin) / (player().vida || 1)) : null,
      mortes: c.deaths || 0, xpPerdido: c.xpLost || 0, potUsadas: c.bossFase?.potions || 0, healSkillS,
      build, skills, hist,
      analise: analisarLutaBoss(t0, c.endedAt || Date.now()),
    };
    const erro = (est && real.potUsadas != null && est.potTotal != null) ? real.potUsadas - est.potTotal : null;
    const cmp = { boss: c.boss, morreu: real.mortes > 0, hpMinPct: real.hpMinPct, estPot: est?.potTotal ?? null, realPot: real.potUsadas, erroPot: erro, estT: est?.tKillS ?? null, realT: real.durS, estHealS: est ? Math.round(est.curaSkill) : null, realHealS: healSkillS, build: build.join(',') };
    // mantém as 50 últimas de CADA boss
    const todas = [{ at: Date.now(), ...real, est: est || null }, ...(farm.lutas || [])];
    const por = {}; const out = [];
    for (const l of todas) { por[l.boss] = (por[l.boss] || 0) + 1; if (por[l.boss] <= 50) out.push(l); }
    farm.lutas = out;
    logEvent('luta-chefe', cmp);
    console.log('[LolidleAuto] luta', JSON.stringify(cmp));
  }

  // ------------------------------------------------------------- skills / equip
  // Cura/preço das poções vêm do MOTOR (META.pocoes) — fallback só se o meta não carregou.
  // `nivel` = nível MÍNIMO que a loja exige (motor.js:261-267 `POCOES`: a Suprema só no 30, a
  // Forte no 15). Sem este campo, a extensão não sabia que a Suprema não existe no nível 15 e
  // ficava a pedi-la para sempre — era a raiz do ciclo de recall (ver `minimoPocoesAgora`).
  const POCAO_FB = { vida: { cura: 300, preco: 40, nivel: 1 }, vidaF: { cura: 900, preco: 110, nivel: 15 }, vidaS: { cura: 2200, preco: 260, nivel: 30 } };
  const pocaoInfo = (k) => (META.pocoes && META.pocoes[k]) || POCAO_FB[k];
  /** ONDE o fallback das poções discorda do motor (cura/preço/nível). Vazio = o motor ainda não
   *  falou, ou concorda. É o que impede uma cópia congelada de passar por verdade (REGRA N.º 3). */
  function divergenciasPocao() {
    const out = [];
    const M = META.pocoes || null;
    if (!M) return out;
    for (const k of Object.keys(POCAO_FB)) {
      const a = POCAO_FB[k], b = M[k];
      if (!b) continue;
      for (const campo of ['cura', 'preco', 'nivel']) if (a[campo] !== b[campo]) out.push({ pocoes: k, campo, fallback: a[campo], motor: b[campo] });
    }
    return out;
  }
  /** ONDE o kit de FALLBACK (KAT_FB, o da Katarina) discorda do kit do MOTOR. O KAT_FB so e usado
   *  quando o motor nao manda kit nenhum; quando manda, isto ACUSA a diferenca em vez de a deixar
   *  congelada. Compara so com a Katarina (e o unico campeao do fallback). */
  function divergenciasKit(id) {
    const campeao = id || (META.champAtual && META.champAtual.id) || null;
    if (campeao !== 'katarina') return [];
    const fonte = META.kits && META.kits[campeao];
    if (!fonte || !fonte.kit) return [];
    const out = [];
    for (const t of Object.keys(KAT_FB)) {
      const fb = KAT_FB[t], mot = fonte.kit[t];
      if (!mot) continue;
      for (const campo of ['max', 'mult', 'alvo', 'adRatio']) if (fb[campo] != null && mot[campo] != null && fb[campo] !== mot[campo]) out.push({ campeao, hab: t, campo, fallback: fb[campo], motor: mot[campo] });
      for (const campo of ['base', 'ratio', 'recarga']) {
        const a = fb[campo === 'recarga' ? 'rec' : campo], b = mot[campo];
        if (typeof a === 'function' && Array.isArray(b)) for (let r = 1; r <= Math.min(b.length, 10); r++) {
          const va = a(r), vb = b[r - 1];
          if (Number.isFinite(va) && Number.isFinite(vb) && Math.abs(va - vb) > 1e-9) out.push({ campeao, hab: t, campo, rank: r, fallback: va, motor: vb });
        }
      }
    }
    return out;
  }
  /** A LOJA VENDE esta poção ao nível dele? (motor.js:261-267 `POCOES[k].nivel`; `META.pocoes`
   *  vem do motor pelo inject.js.) Fora do nível, o botão de compra vem `disabled` no jogo. */
  function pocaoCompravel(k) {
    const nv = pocaoInfo(k).nivel;
    return !nv || ((player() || {}).nivel || 1) >= nv;
  }
  const EXAUSTAO = () => (Number.isFinite(META.exaustao) ? META.exaustao : 1);
  const HEALVAL = { get vida() { return pocaoInfo('vida').cura; }, get vidaF() { return pocaoInfo('vidaF').cura; }, get vidaS() { return pocaoInfo('vidaS').cura; } };

  function readSkills() {
    const arsenal = [...document.querySelectorAll('#hab-ativas .hab[data-t]')].map((h) => {
      const r = (h.textContent || '').match(/(\d+)\s*\/\s*(\d+)/);
      const dica = h.getAttribute('data-dica') || '';
      return {
        t: h.dataset.t, name: dica.split('—')[0].trim(),
        dica,
        rank: r ? +r[1] : null, maxRank: r ? +r[2] : null,
        // REQUISITO DE NÍVEL da habilidade (do kit do motor). Sem isto a GUI recomendava
        // desbloquear uma skill de nível 38 a um boneco de nível 29 — bug relatado pelo dono.
        nivel: ((KAT && KAT[h.dataset.t]) || {}).nivel || 1,
        onBar: h.classList.contains('na-barra'), max: h.classList.contains('maximo'),
        // `escolhida` = o jogo está em modo TROCA com esta habilidade (jogo.js:5857 põe
        // `trocando = hk` e jogo.js:6604 marca-a com `.escolhida`). O clique seguinte num
        // `#barra .hab` chama `trocarNaBarra` (motor.js:2841) em vez de `alternarBarra`.
        // Sem ler isto, o primeiro clique na barra TROCA quando queríamos TIRAR.
        escolhida: h.classList.contains('escolhida'),
      };
    });
    const rankDe = {};
    for (const h of arsenal) if (h.t) rankDe[h.t] = h.rank;
    // CDR para converter a fraccao em segundos: o do painel (`#st-cdr`, jogo.js:6465) quando
    // existir; senao a soma dos itens. Uma vez so — nao por skill.
    const cdrLido = player().cdr;
    const cdrUsado = cdrLido != null ? cdrLido : ((efeitosEquipados() || {}).cdr || 0);
    // RECARGA EXACTA — o defeito que a observabilidade mediu (P0-3): o `<em>` do HUD fica VAZIO
    // abaixo de 1 s (jogo.js:6227) e o `cdDe()` convertia esse vazio em 0 = PRONTA. A fraccao
    // EXACTA esta em `--cd` (jogo.js:6228) e nao some. `cd` passa a ser o segundo real.
    const bar = [...document.querySelectorAll('#hud-habs .hud-hab')].map((b) => {
      const t = b.dataset.t;
      const em = b.querySelector('em');
      const seg = em && em.textContent ? Number(em.textContent) : null;
      const recarga = b.classList.contains('recarga');
      const nome = (b.getAttribute('data-dica') || '').split('—')[0].trim() || (b.title || '').split('—')[0].trim() || t;
      const frac = varCd(b);
      const ex = cdExatoHud(frac, t, rankDe[t] || null, cdrUsado);
      const cd = ex && ex.seg != null ? ex.seg : (recarga ? (seg != null ? seg : 0) : 0);
      return { t, nome, cd, cdFrac: frac, cdEm: seg, cdAprox: !!(ex && ex.aprox), rank: rankDe[t] || null,
        // `sem-mana` (jogo.js:6232) e `aprimorada` (jogo.js:6237, Yasuo: o proximo Q e o tornado):
        // classes que o jogo escreve e que a extensao nunca leu.
        semMana: b.classList.contains('sem-mana'), aprimorada: b.classList.contains('aprimorada'),
        custo: txtEl(b.querySelector('b')).trim() || null,
        ready: !recarga && !(frac > 0) };
    });
    // PONTOS LIVRES — e o HUD diz DE QUE TIPO SÃO. BUG MEDIDO: o código pegava só o primeiro
    // número e chamava-lhe `pontos` de HABILIDADE. Com o HUD a dizer "+ Pontos para usar 15 de
    // atributo", o `subirHabilidades` achava que havia 15 pontos de skill, tentava subir, o jogo
    // recusava (0 reais) e devolvia `{ok:false, gastos:0}` EM SILÊNCIO — foi por isso que a
    // ultimate nunca subiu e os 15 pontos de atributo ficaram parados.
    const hp = document.getElementById('hud-pontos');
    const hudTexto = (hp && !hp.hidden) ? String(hp.textContent || '') : '';
    const nHud = Number((hudTexto.match(/\d+/) || [])[0]) || 0;
    const ehAtrib = /atributo/i.test(hudTexto);
    const pontos = (hudTexto && !ehAtrib) ? (nHud || 1) : 0;   // pontos de SKILL
    const pontosAtrib = (hudTexto && ehAtrib) ? nHud : 0;       // pontos de ATRIBUTO
    return { bar, arsenal, pontos, pontosAtrib, hudTexto, cdr: cdrUsado };
  }

  function readEquip() {
    return [...document.querySelectorAll('#equip > button.slot[data-id]')].map((b) => {
      const [baseRef, qual] = (b.getAttribute('data-id') || '').split('~');
      const [base, ref] = (baseRef || '').split('+');
      const dica = b.getAttribute('data-dica') || '';
      const cls = String(b.className);
      return {
        id: b.getAttribute('data-id'), base, refino: ref ? +ref : 0, qual,
        nome: dica.split('(')[0].trim(), dica, stats: parseDica(dica),
        raridade: cls.includes('lendario') ? 'lendario' : cls.includes('epico') ? 'epico' : 'basico',
      };
    }).filter((e) => e.base);
  }

  // =====================================================================
  // CAMADA DE DADOS: meta do jogo (wiki) + agregados + avaliação de risco
  // =====================================================================
  const META_KEY = STORAGE_KEY + ':meta';
  const AGG_KEY = STORAGE_KEY + ':agregado';
  const META = { monstros: null, locais: null, balanco: null, itens: null, ondeItem: null, at: null, erro: null,
    pocoes: null, exaustao: null, pocaoPvp: null, noturno: null, furioso: null, gemas: null, recall: null, grupo: null, nivelMax: null, espacos: null, curva: null, kit: null, champ: null, rodizio: null, mecanicas: null, kits: null, mochila: null, ciclo: null, fuso: null, grupoSpawn: null, champAtual: null, nivelDif: null, habChefe: null };

  // (removido o parser de JS com eval — violava a CSP; o meta agora vem pronto do
  //  inject.js via postMessage)

  /** Recebe o meta do inject.js (mundo MAIN) e cacheia. */
  function carregarMeta() {
    window.addEventListener('message', (e) => {
      const d = e.data;
      if (!d) return;
      if (d.__lolidleAuto === 'meta-erro') { META.erro = d.erro; logIssue('meta-falha', { erro: d.erro }); return; }
      if (d.__lolidleAuto === 'chefe-hook') { META.chefeHook = !!d.ok; META.chefeHookErro = d.erro || null; return; }
      // TK-INT-01 — os DOIS canais que o inject.js já publica e que morriam aqui:
      //   'estado' = o `combate` INTEIRO a cada mudança estrutural / 250 ms (inject.js:430-438);
      //   'evento' = os tipos do motor que DECIDEM (inject.js:222-224, motor.js:1182 `emitir`).
      // Ambos ficam disponíveis por `estadoVivo()`/`eventosVivos()` e são consumidos por
      // `consumirEvento` (abaixo) — sem isto o motor era lido pela UI e por mais ninguém.
      if (d.__lolidleAuto === 'estado') { _estadoVivo = d; return; }
      if (d.__lolidleAuto === 'evento') { consumirEvento(d); return; }
      if (d.__lolidleAuto !== 'meta') return;
      if (d.chefeHook != null) META.chefeHook = d.chefeHook;
      if (d.chefeHookErro) META.chefeHookErro = d.chefeHookErro;
      if (d.monstros) META.monstros = d.monstros;
      if (d.locais) META.locais = d.locais;
      if (d.balanco) META.balanco = d.balanco;
      if (d.itens) META.itens = d.itens;
      if (d.ondeItem) META.ondeItem = d.ondeItem;
      // `curvaPorNivel`/`rmMonstro` (TK-INT-01): curva REAL avaliada por nível e o RM dos
      // monstros, ambos LIDOS do motor pelo inject.js — quem consome é o `curva()`/`rmMonstro()`.
      for (const k of ['pocoes', 'exaustao', 'pocaoPvp', 'noturno', 'furioso', 'gemas', 'recall', 'grupo', 'nivelMax', 'espacos', 'curva', 'curvaPorNivel', 'rmMonstro', 'kit', 'champ', 'rodizio', 'mecanicas', 'kits', 'mochila', 'ciclo', 'fuso', 'grupoSpawn', 'respawn', 'modelos', 'dicaAtributos', 'nivelDif', 'habChefe']) if (d[k] != null) META[k] = d[k];
      if (d.kit || d.kits) aplicarKit();
      if (META.monstros && META.locais && META.balanco) {
        META.at = Date.now(); META.erro = null;
        try { chrome.storage.local.set({ [META_KEY]: { at: META.at, monstros: META.monstros, locais: META.locais, balanco: META.balanco, itens: META.itens, ondeItem: META.ondeItem } }); } catch { /* ignore */ }
        // (sem logEvent de meta: a re-injeção dispara várias e inunda o log)
      }
    });
    try { window.postMessage({ __lolidleAuto: 'pedir-meta' }, '*'); } catch { /* ignore */ }
  }

  const ajusteDe = (n) => (META.balanco || []).find((b) => n >= b.de && n <= b.ate) || { vida: 1, dano: 1, xp: 1, ouro: 1 };
  function curva(nivel) {
    // CURVA REAL, LIDA do motor (REGRA Nº 3): o inject.js avalia as funções `CURVA`
    // (motor.js:282-288) por nível e manda os NÚMEROS em `META.curvaPorNivel` — com o
    // `ajuste` da planilha (motor.js:281, balanco.js) já DENTRO de cada valor, logo NÃO se
    // multiplica outra vez. Se o jogo nerfar/buffar a curva amanhã, este número acompanha
    // sozinho. Fallback (inject antigo): polinómio pelos coeficientes × o ajuste da planilha.
    const cn = META.curvaPorNivel && META.curvaPorNivel[nivel];
    if (cn && Number.isFinite(cn.hp)) return { hp: cn.hp, ad: cn.ad, armadura: cn.armadura, xp: cn.xp, ouro: cn.ouro };
    const a = ajusteDe(nivel);
    // Coeficientes vêm do motor (META.curva); fallback = fórmula original.
    const c = META.curva || { hp: [150, 100, 1], ad: [9, 4.8, 0.13], armadura: [5, 1.5], xp: [30, 7], ouro: [8, 3.5] };
    const poly = (co, n) => co.reduce((s, k, i) => s + k * Math.pow(n, i), 0);
    return { hp: poly(c.hp, nivel) * a.vida, ad: poly(c.ad, nivel) * a.dano, armadura: poly(c.armadura, nivel), xp: poly(c.xp, nivel) * a.xp, ouro: poly(c.ouro, nivel) * a.ouro };
  }
  /** NIVEL DO CHEFE — a regra EXACTA do motor (motor.js:1121):
   *    `nivelJogador == null ? n1 + 2 : Math.max(n0 + 2, Math.min(n1 + 2, nivelJogador + 4))`
   *  A extensao usava `nm[1] + 2` — o TOPO da faixa — e afastava o boneco do chefe MEDIDO: um
   *  jogador de nivel 25 no Rio (nm 25-33) enfrenta o Arauto de nivel 29 pelo motor, nao 35,
   *  HP x1,25 e AD x1,31 a mais (docs/auditoria-do-jogo.md C5; docs/observabilidade.md §C5).
   *  `nivelJogador` ausente (sem jogador lido) cai no topo + 2, que e o que o motor faz quando
   *  nao ha nivel do jogador (motor.js:1121, ramo `nivelJogador == null`). */
  /** Nome do MOTOR para o nivel do chefe (o banco chama `nivelDoChefe(local, nivelJogador)`). */
  const nivelDoChefe = (local, nivelJogador) => nivelChefeDe(local, nivelJogador);
  function nivelChefeDe(local, nivelJogador) {
    if (!local) return null;
    const nm = local.nm || local.faixa || null;
    if (!nm) return null;
    const n0 = +nm[0] || 1, n1 = nm[1] != null ? +nm[1] : n0;
    // `undefined` = nao passado -> le o jogador; `null` = EXPLICITAMENTE sem jogador -> ramo do motor (n1+2)
    const p = nivelJogador === undefined ? (player() || {}).nivel : (nivelJogador == null ? null : +nivelJogador);
    if (p == null || !(p > 0)) return n1 + 2;
    return Math.max(n0 + 2, Math.min(n1 + 2, p + 4));
  }

  /** Stats de um monstro/chefe num nível (do motor). */
  function statsMonstro(nome, nivel) {
    const m = META.monstros?.[nome];
    if (!m) return null;
    const c = curva(nivel);
    return { nome, nivel, hp: c.hp * m.hp, ad: c.ad * m.ad, as: m.as, armadura: c.armadura * m.armadura, xp: c.xp * m.xp, ouro: c.ouro * m.ouro * 0.75, chefe: !!m.chefe, magico: !!m.magico };
  }

  // ============ TECTOS DO MOTOR — UM sitio só, cada um com o file:linha ============
  // Os limites do jogo estavam espalhados por 6 `Math.min(...)` soltos no ficheiro, copiados.
  // Ficam aqui nomeados. NENHUM destes é exportado pelo motor (sao inline), pelo que a fonte e o
  // file:linha indicado — se o jogo os mudar, ha UM sitio a corrigrir (e o teste de caps apanha).
  const CAP_CDR = 0.4;             // motor.js:537  `reducaoRecarga: Math.min(0.4, ...)`
  const CAP_PEN_MAG = 0.6;         // motor.js:529  `penMagica: Math.min(0.6, ...)`
  const CAP_ESQUIVA = 0.25;        // motor.js:536  `esquiva: Math.min(0.25, ...)`
  const CAP_CRITICO = 1;           // motor.js:541  `critico: Math.min(1, ...)`
  const VEL_ATAQUE_MAX = 3;        // motor.js:344  `export const VEL_ATAQUE_MAX = 3`
  /** Pen de ARMADURA maxima (motor.js:539): `1 - (1 - penE) * (tem('3036') ? 0.7 : 1)`.
   *  A extensao usava `Math.min(0.7, ...)` como tecto da SOMA — um numero que o motor nunca
   *  aplica e que nao mordia nunca. Com o pen do kit (max 0,45, motor.js:560) e a 3036 o valor
   *  real do motor e 1-(1-0,45)x0,7 = 0,835. */
  const penArmaduraDe = (penE = 0, tem3036 = false) => 1 - (1 - Math.max(0, penE)) * (tem3036 ? 0.7 : 1);

  // ===================== MITIGAÇÃO — RM_MONSTRO (correcção do Lead, 2026-10-14) =====================
  // O motor NÃO usa a armadura do monstro contra o dano MÁGICO: usa 60% dela.
  //   motor.js:1177-1178 "dano mágico ignora a armadura: os monstros não têm resistência mágica"
  //                       "RM_MONSTRO: a resistência mágica dos monstros é 60% da armadura"
  //   motor.js:1179 `export const RM_MONSTRO = 0.6;`
  //   motor.js:1202 `arm = magico ? (poder ? alvo.armadura * RM_MONSTRO * (1 - (a.penMagica||0)) : 0)
  //                            : alvo.armadura * (1 - alvo.reducaoArmadura) * (1 - a.penArmadura)`
  //   motor.js:2155 (veneno) e motor.js:1167 `mitigar(dano, armadura) = dano * 100/(100+max(0,armadura))`.
  // SEM isto o dano mágico do jogador ficava SUBESTIMADO (~1,6x a 104 de armadura: 100/164 = 0,61
  // contra 100/(100+62,4) = 0,62 -> o factor 0,6 na armadura é que faz a diferença: 1/0,6 = 1,67x).
  // IMPORTANTE — onde NÃO se aplica: ao dano que o JOGADOR TOMA, o motor usa a `rm` do jogador
  // (motor.js:3101 `mag(2.6) => mitigar(i.ad*2.6, a.rm)`, onde `a` é o jogador) — o jogador não é
  // um monstro. É por isso que `danoMecanica`/`avaliar` (que medem o dano RECEBIDO) ficam como estão.
  /** RM_MONSTRO do motor (motor.js:1179). Vem do META se o `inject.js` o expuser; o fallback é o
   *  valor do motor, com o file:linha (nunca um 0.6 solto). */
  const rmMonstro = () => numOr(META.rmMonstro, 0.6);   // motor.js:1179
  /** O campeão actual é de MAGIA? (motor.js:22 `classeItem` / `kit(estado).magia`.) Fica numa funcao
   *  so para nao repetir `(META.champAtual && META.champAtual.magia)` em 12 sitios. */
  const magiaChamp = () => !!(META.champAtual && META.champAtual.magia);
  /** Mitigação da SAÍDA do jogador contra um monstro — a mesma conta do `estimarSet`/`scoreSet`
   *  (motor.js:1202): o mago bate na resistência mágica do monstro (armadura x RM_MONSTRO), o AD
   *  bate na armadura com a pen de armadura. Serve para a CURA: o roubo de vida cura o dano
   *  DEPOIS de mitigar (motor.js:1226-1228, `golpear`). */
  function mitSaida(s, magia) {
    const ef = (typeof efeitosEquipados === 'function' ? efeitosEquipados() : {}) || {};
    const arm = magia ? armMagicaEfetiva(s && s.armadura, ef.penMag) : ((s && s.armadura) || 0) * (1 - (ef.penArmadura || 0));
    return 100 / (100 + Math.max(0, arm));
  }

  /** Armadura EFECTIVA do alvo contra dano MÁGICO (motor.js:1202). */
  const armMagicaEfetiva = (armadura, penMag) => Math.max(0, (armadura || 0) * rmMonstro() * (1 - (penMag || 0)));

  // ============ VALOR REAL DA PEÇA (motor.js) — o `preco` do catálogo é o BASE ============
  // Correcção do Lead (2026-10-14), a partir do print do dono: 'Ímpeo Cósmico +3 [A]' com
  // '5.625 de ouro no Lojista'. O motor da extensão só tinha `preco: 3000` (o base).
  //   motor.js:55  `BONUS_REFINO = 0.12`
  //   motor.js:173-178 QUALIDADES: C {mult 0.9, venda 0.8} | B {1, 1} | A {1.15, 1.5} |
  //                S {1.35, 3} | SS {1.7, 8}
  //   motor.js:2898 `valorEquip(x) = preco * (1 + BONUS_REFINO*refino) * QUALIDADES[qual].mult`
  //                (a MESMA conta do `poder`, motor.js:248)
  //   motor.js:257  `valorVenda(x) = floor(preco * 0.5 * (1 + 0.5*refino) * QUALIDADES[qual].venda)`
  // CONFERIDO com o print: 3000 * (1+0.12*3) * 1.15 = 4692 (valorEquip) e
  // 3000 * 0.5 * (1+0.5*3) * 1.5 = 5625 (valorVenda = os '5.625 no Lojista' do ecrã).
  // A razão 5625/4692 = 1,199 NÃO é uma 'margem do Lojista' (essa 3.ª função NÃO existe): é a
  // diferença entre as DUAS fórmulas do motor (0.5 e `venda` contra 1.0 e `mult`).
  const BONUS_REFINO = 0.12;                                    // motor.js:55
  const QUAL_MULT = { C: 0.9, B: 1, A: 1.15, S: 1.35, SS: 1.7 };  // motor.js:174-178 (`mult`)
  const QUAL_VENDA = { C: 0.8, B: 1, A: 1.5, S: 3, SS: 8 };       // motor.js:174-178 (`venda`)
  /** VALOR DE EQUIPAMENTO da peça (motor.js:2898 / motor.js:248). `null` sem catálogo. */
  function valorEquip(base, qual, refino) {
    const it = (META.itens || []).find((x) => String(x.id) === basePura(base));
    if (!it) return null;
    // `QUALIDADES[qual]?.mult || 1` — a MESMA regra do motor (motor.js:182-188 + 2921): a
    // qualidade '?' (sendo avaliada) NAO existe no mapa, logo vale 1 — NAO 0,9 (o 'C'). Antes era
    // `String(qual || 'C')`, que punia uma peça pendente como se fosse qualidade C.
    return Math.round((it.preco || 0) * (1 + BONUS_REFINO * (refino || 0)) * (QUAL_MULT[String(qual || '').toUpperCase()] || 1));
  }
  /** VALOR DE VENDA no Lojista (motor.js:257). `null` sem catálogo. */
  function valorVenda(base, qual, refino) {
    const it = (META.itens || []).find((x) => String(x.id) === basePura(base));
    if (!it) return null;
    // `QUALIDADES[qual]?.venda || 1` — mesmo critério do motor (motor.js:266): '?' vale 1.
    return Math.floor((it.preco || 0) * 0.5 * (1 + 0.5 * (refino || 0)) * (QUAL_VENDA[String(qual || '').toUpperCase()] || 1));
  }

  // Penalidade de XP/ouro por diferença de nível (motor.js:420). Acima de 5 níveis
  // de diferença, cai 0,1 por nível, com piso 0,1. Matar mob muito abaixo = 10%.
  const fatorXp = (pj, mob) => { const dif = pj - mob; return dif > 5 ? Math.max(0.1, 1 - 0.1 * (dif - 5)) : 1; };
  const fatorSaque = fatorXp;

  // ---- noite/dia e multiplicadores de furioso/noturno (motor.js) ----
  const CICLO = () => (META.ciclo || 86400), HORA = 3600, FUSO = () => (META.fuso != null ? META.fuso : -3);
  function luzDoDia(rel) { const C = CICLO(); const t = ((rel % C) + C) % C; if (t >= 6.5 * HORA && t < 17.5 * HORA) return 1; if (t >= 17.5 * HORA && t < 18.5 * HORA) return 1 - ((t - 17.5 * HORA) / HORA) * 0.72; if (t >= 5.5 * HORA && t < 6.5 * HORA) return 0.28 + ((t - 5.5 * HORA) / HORA) * 0.72; return 0.28; }
  function ehNoite() { const C = CICLO(); const rel = (((Date.now() / 1000) + FUSO() * HORA) % C + C) % C; return luzDoDia(rel) < 0.6; }
  // chances de furioso/noturno e runas: do MOTOR (META.noturno/furioso/gemas) com fallback
  const gv = (grupo, campo, fb) => { const g = META[grupo]; return g && g[campo] != null ? g[campo] : fb; };
  const gemaCh = (id, campo, fb) => { const g = META.gemas && META.gemas[id]; return g && g[campo] != null ? g[campo] : fb; };
  const NOT = { get chance() { return gv('noturno', 'chance', 0.35); }, get xp() { return gv('noturno', 'xp', 1.8); }, get ouro() { return gv('noturno', 'ouro', 1.5); } };
  const FUR = { get chance() { return gv('furioso', 'chance', 0.05); }, get xp() { return gv('furioso', 'xp', 5); }, get ouro() { return gv('furioso', 'ouro', 5); } };
  // Runas (GEMAS): chance por abate comum e por chefe; escala com o tier (+10%/tier).
  const GEMA_CH = { get sorte() { return gemaCh('sorte', 'chance', 0.0053); }, get arcana() { return gemaCh('arcana', 'chance', 0.00063); }, get protecao() { return gemaCh('protecao', 'chance', 0.00063); } };
  const GEMA_CHEFE = { get sorte() { return gemaCh('sorte', 'chefe', 0.3); }, get arcana() { return gemaCh('arcana', 'chefe', 0.08); }, get protecao() { return gemaCh('protecao', 'chefe', 0.08); } };
  /** Multiplicador MÉDIO de XP/ouro por furioso (5% ×5) e noturno (35% à noite ×1,8/×1,5). */
  function multMedio(mobsPerWave) {
    const pF = FUR.chance / Math.max(1, mobsPerWave);
    const pN = (1 - pF) * (ehNoite() ? NOT.chance : 0);
    const pP = 1 - pF - pN;
    return { xp: pF * FUR.xp + pN * NOT.xp + pP, ouro: pF * FUR.ouro + pN * NOT.ouro + pP, noite: ehNoite() };
  }

  /** DPS do personagem, derivado do medido: numa região DPS-limitada, DPS = mobHp × kills/min. */
  function meuDps() {
    const agg = agregar();
    for (const r of agg) {
      if (!r.killsMin || r.killsMin <= 0) continue;
      const l = (META.locais || []).find((x) => r.region.startsWith(x.nome));
      if (!l) continue;
      const e = estimarRegiao(l.id, { dps: 0 });
      if (!e || !e.mobHp) continue;
      if (r.killsMin < e.killsMin * 0.9) return Math.round(e.mobHp * r.killsMin / 60);
    }
    return null;
  }

  /** Estima XP/ouro por minuto de uma região (mesmo nunca jogada), com meta + waves. */
  function estimarRegiao(id, opts) {
    opts = opts || {};
    const loc = (META.locais || []).find((l) => l.id === id);
    if (!loc || !loc.monstros) return null;
    const p = player();
    const vip = opts.vip != null ? opts.vip : true;
    const bonus = opts.bonus || 1;
    // O mob nasce perto do jogador (motor.js:1110): nivel = clamp(P-2+rand(0..3), n0, n1) → média P-0,5
    const [n0, n1] = loc.nm || [p.nivel, p.nivel];
    const L = opts.mobLevel != null ? opts.mobLevel : Math.max(n0, Math.min(n1, p.nivel - 0.5));
    const fx = fatorXp(p.nivel, L), fs = fatorSaque(p.nivel, L);
    let wsum = 0, xpK = 0, goldK = 0, hpAvg = 0;
    for (const [nome, w] of loc.monstros) {
      const s = statsMonstro(nome, L); if (!s) continue;
      xpK += w * s.xp * fx * (vip ? 1.2 : 1) * bonus;
      goldK += w * s.ouro * fs * bonus;
      hpAvg += w * s.hp; wsum += w;
    }
    if (!wsum) {
      // Sem stats de monstro nao ha taxa teoica -- e tambem NAO ha prova de sobrevivencia.
      // Fail-closed: a regiao fica marcada como nao segura em vez de devolver null (que o
      // filtro trataria como "nao sei" e, antes desta correccao, deixava passar).
      return { id, nome: loc.nome, faixa: loc.faixa, tier: loc.tier, mobLevel: null, mobHp: null,
        killsMin: null, xpMin: null, goldMin: null, runasH: null, morte: true,
        riscoMob: null, riscoDps: null, riscoTMorrer: null, semDados: true };
    }
    xpK /= wsum; goldK /= wsum; hpAvg /= wsum;
    const gs = META.grupoSpawn || { base: 2, rand: 3 };   // motor.js:1137 (medido pelo inject)
    // media de 2 + floor(rand*3) (motor.js:1137) — a MESMA funcao do ritmoMobs (TK-01-08)
    const mobsPerWave = opts.mobsPerWave != null ? opts.mobsPerWave : mediaWaveDe(gs);
    const mm = multMedio(mobsPerWave);
    xpK *= mm.xp; goldK *= mm.ouro;
    const rsp = META.respawn || { clear: 1.5, local: 1.2 };
    const respawnS = opts.respawnS != null ? opts.respawnS : (rsp.clear + rsp.local);   // motor.js: respawn 1,5 (wave limpa) + 1,2 (chegada)
    const spawnKillsMin = (mobsPerWave / respawnS) * 60;
    const myDps = opts.dps != null ? opts.dps : (meuDps() || 0);
    let killsMin = spawnKillsMin, modo = 'spawn';
    if (myDps > 0) {
      const killS = hpAvg / myDps;                                          // AoE: a wave cai quase junto
      const dpsKillsMin = (mobsPerWave / (killS + respawnS)) * 60;
      if (dpsKillsMin < spawnKillsMin) { killsMin = dpsKillsMin; modo = 'dps'; }
    }
    const kx = opts.kXp != null ? opts.kXp : ((cfg.kReg || {})[id]?.kXp || cfg.kXp || 1), ko = opts.kOuro != null ? opts.kOuro : ((cfg.kReg || {})[id]?.kOuro || cfg.kOuro || 1);
    const gk = 1 + (loc.tier || 0) * 0.1;                       // runas: +10% de chance por tier
    const multR = (vip ? 1.2 : 1) * fs;                          // runas levam o bônus de drop VIP e o fatorSaque
    let runasKill = 0; for (const gid of ['sorte', 'arcana', 'protecao']) runasKill += Math.min(1, GEMA_CH[gid] * gk * multR);
    const runasChefe = loc.chefe ? (GEMA_CHEFE.sorte + GEMA_CHEFE.arcana + GEMA_CHEFE.protecao) * (vip ? 1.2 : 1) : 0;
    // ---- SOBREVIVÊNCIA EM TODAS AS REGIÕES (correcção do Lead, 2026-10-14) --------------------
    // MEDIDO AO VIVO (Katarina nv 29): `estimarRegiao('barao')` devolvia { goldMin: 5428,
    // xpMin: 15765 } SEM campo `morte` — e a `regiaoIdeal` filtrava com `!x.e.morte`, onde
    // `!undefined === true`: o filtro de morte era um NO-OP e o Covil do Barão (faixa 40-50)
    // encabeçava o ranking com a taxa TEÓRICA. O boneco ia para lá morrer.
    // A avaliação usa a MESMA função do resto do ficheiro (`avaliar`, automation.js:1493),
    // monstro a monstro; basta UM mob que mate para a região NÃO ser segura. `morte: null`
    // significa NÃO SE SABE — e o filtro é FAIL-CLOSED (não se sabe não manda ninguém morrer).
    let morte = null, avaliados = 0, riscoMob = null, riscoDps = null, riscoTMorrer = null;
    try {
      const curaMob = { skill: 0, pocao: curaPocaoMax() * 0.6 };
      // (i) A ZONA ESTÁ ACIMA DO BONECO? É a regra determinística e é a que apanha o caso medido
      // (Covil do Barão, `nm: [40, 48]`, com o boneco a 29). A tolerância é a MESMA que o
      // `doNivel0` logo abaixo já usa (6 níveis) — não se inventa um critério novo.
      const nivelMin = (loc.nm && loc.nm[0] != null) ? loc.nm[0] : (loc.faixa ? loc.faixa[0] : null);
      const acima = nivelMin != null && (p.nivel || 1) + 6 < nivelMin;
      if (acima) morte = true;
      for (const par of (loc.monstros || [])) {
        const a = avaliar(par[0], Math.round(L), p, curaMob);
        if (!a) continue;
        avaliados++;
        // (ii) MECÂNICA INSTA-KILL (o `mortal` do avaliador: o pior golpe do rodízio passa da vida).
        // (iii) MORRE ANTES DE MATAR: tempo até morrer < tempo de matar UM mob (com margem de 50%).
        //       Só quando há DPS conhecido — com DPS 0 o critério seria "morre sempre" e travava
        //       o farm todo (é a diferença entre uma medida e um chute).
        const usaTempo = (myDps || 0) > 0 && a.hp && Number.isFinite(a.tMorrer);
        const segMatar = usaTempo ? a.hp / Math.max(1, (myDps || 0) * (a.fJ || 1)) : null;
        if (a.mortal || (usaTempo && a.tMorrer < segMatar * 1.5)) { morte = true; riscoMob = par[0]; }
        if (Number.isFinite(a.dpsTomado)) riscoDps = Math.max(riscoDps || 0, Math.round(a.dpsTomado));
        if (Number.isFinite(a.tMorrer)) riscoTMorrer = Math.min(riscoTMorrer == null ? Infinity : riscoTMorrer, +a.tMorrer.toFixed(1));
      }
      if (riscoTMorrer === Infinity) riscoTMorrer = null;
      // (iii-b) O CHEFE DA REGIAO — a avaliação de luta que faltava (TK-02-41): a região tem
      // um chefe com os stats do META e o `avaliar()` já sabe dizer se ele MATA. Sem olhar para
      // o chefe, uma zona com mobs fáceis e chefe letal (Fosso do Dragão a nv 27) passava como
      // segura -- era esse o buraco: avaliavam-se os mobs da lista e nunca o chefe.
      // nível pelo motor (motor.js:1134): max(n0+2, min(n1+2, nível+4)).
      try {
        if (loc.chefe && loc.chefe[0]) {
          const nc = nivelChefeDe(loc);
          const avc = avaliar(loc.chefe[0], nc, p, curaMob);
          if (avc) {
            avaliados++;
            if (avc.mortal) { morte = true; riscoMob = loc.chefe[0]; }
            if (Number.isFinite(avc.dpsTomado)) riscoDps = Math.max(riscoDps || 0, Math.round(avc.dpsTomado));
            if (Number.isFinite(avc.tMorrer)) riscoTMorrer = Math.min(riscoTMorrer == null ? Infinity : riscoTMorrer, +avc.tMorrer.toFixed(1));
            // o chefe aguenta muito mais que um mob: morrer ANTES de o matar é o critério.
            //  (a) insta-kill: o pior golpe do rodízio passa da vida (`mortal`);
            //  (b) com DPS conhecido: morre em menos de 1,5x o tempo que leva a matá-lo;
            //  (c) SEM DPS conhecido: se o chefe bate mais do que a cura estimada cobre
            //      (`liquido > 0`), não há prova de que a luta se ganha — fail-closed.
            const usaTempoC = (myDps || 0) > 0 && avc.hp && Number.isFinite(avc.tMorrer);
            const segMatarC = usaTempoC ? avc.hp / Math.max(1, (myDps || 0) * (avc.fJ || 1)) : null;
            if (avc.mortal || (usaTempoC && avc.tMorrer < segMatarC * 1.5) || (!usaTempoC && avc.liquido > 0)) {
              morte = true; if (!riscoMob) riscoMob = loc.chefe[0];
            }
          }
        }
      } catch { /* ignore */ }
      // (iv) O HISTÓRICO MEDIDO manda: se aquela região já o matou, não é segura.
      try {
        const rr = (agregar() || []).find((x) => x.region && String(x.region).startsWith(String(loc.nome)));
        if (rr && rr.risco && rr.risco.morre) morte = true;
      } catch { /* ignore */ }
      // FAIL-CLOSED (regra do dono: "NAO E PRA MORRER, NUNCA, COM ESSE SCRIPT"): sem prova de
      // que sobrevive, a regiao NAO e segura. `avaliados === 0` significa que nao conseguimos
      // olhar para nenhum monstro da regiao (sem stats, sem META) — isso e exatamente o caso em
      // que um `!undefined === true` mandava o boneco para a morte. Agora `morte: true`.
      // O filtro `x.e.morte === false` (regiaoIdeal/rankRegioes) so passa quem PROVOU.
      if (morte === null) morte = avaliados > 0 ? false : true;
    } catch { /* ignore */ }
    return { killsMinTeorico: (killsMin > 0 ? killsMin : 1), kAbates: (cfg.kAbates != null ? cfg.kAbates : 1), id, nome: loc.nome, faixa: loc.faixa, tier: loc.tier, mobLevel: +L.toFixed(1), fatorXp: fx, noite: mm.noite, multXp: +mm.xp.toFixed(3), multOuro: +mm.ouro.toFixed(3), mobHp: Math.round(hpAvg), mobsPerWave, minhaDps: myDps || null, modo, kXp: kx, kOuro: ko, xpKill: +(xpK * kx).toFixed(2), goldKill: +(goldK * ko).toFixed(2), killsMin: +killsMin.toFixed(1), xpMin: Math.round(xpK * kx * killsMin), goldMin: Math.round(goldK * ko * killsMin), runasKill: +runasKill.toFixed(5), runasMin: +(runasKill * killsMin).toFixed(2), runasChefe: +runasChefe.toFixed(2), runasH: Math.round(runasKill * killsMin * 60), morte, riscoMob, riscoDps, riscoTMorrer };
  }

  /** Calibra o fator de conta (k) comparando o estimado com o MEDIDO.
   *
   *  DUAS FONTES, e a primeira MANDA: o proprio JOGO mede xp/h, ouro/h e abates/h desde que se
   *  abre (`analise`, jogo.js:523-542; desenhado em `#janela-analise`, jogo.js:544-560, e na linha
   *  sempre visivel `#rastreio-analise`, jogo.js:6250-6255). A extensao RE-ESTIMAVA o mesmo com
   *  `kXp`/`kOuro` derivados da sua propria teoria — duas contas da mesma coisa, e a do jogo e a
   *  que nao pode estar errada (e a regra do dono: 'numeros devem serem pegos automaticamente').
   *
   *  - AUTORIDADE (fonte 'jogo'): `k = (medicao do jogo) / (media que a extensao acredita ter)`.
   *    Aplica-se a TEORIA (`estimarRegiao`) para uma regiao que ele nunca rodou nao repetir o
   *    erro que a medicao global do jogo ja mediu.
   *  - FALLBACK (fonte 'extensao'): a media ponderada das regioes ja rodadas, como era antes.
   *  - O `kReg` por regiao NAO muda: comparar regioes entre si precisa da medida de cada uma, e o
   *    numero do jogo e global (nao distingue Rio de Campo Azul). */
  function calibrar() {
    const agg = agregar();
    const ks = [];
    for (const r of agg) {
      if (!r.n || !r.xpMin || !r.goldMin) continue;
      const l = (META.locais || []).find((x) => r.region.startsWith(x.nome));
      if (!l) continue;
      const e = estimarRegiao(l.id, { kXp: 1, kOuro: 1 });
      if (!e || !e.xpMin || !e.goldMin) continue;
      ks.push({ region: r.region, n: r.n, kXp: r.xpMin / e.xpMin, kOuro: r.goldMin / e.goldMin });
    }
    const wn = ks.reduce((s, x) => s + x.n, 0) || 1;
    let kXp = ks.reduce((s, x) => s + x.kXp * x.n, 0) / wn;
    let kOuro = ks.reduce((s, x) => s + x.kOuro * x.n, 0) / wn;
    const kReg = { ...(cfg.kReg || {}) };
    for (const x of ks) { const l = (META.locais || []).find((y) => x.region.startsWith(y.nome)); if (l) kReg[l.id] = { kXp: +x.kXp.toFixed(3), kOuro: +x.kOuro.toFixed(3) }; }
    // ---------- A MEDICAO DO JOGO MANDA (jogo.js:523-542, 544-560, 6250-6255) ----------
    let kAbates = 1, fonte = 'extensao', jogo = null;
    try {
      const J = lerAnaliseJogo();
      if (J.tem) {
        jogo = J;
        // media GLOBAL que a extensao acredita ter: media das regioes medidas, ponderada pelas
        // amostras. E o denominador — sem ele nao ha factor nenhum.
        const nT = agg.reduce((s, x) => s + (x.n || 0), 0) || 0;
        const med = (campo) => (nT ? agg.reduce((s, x) => s + ((x[campo] || 0) * (x.n || 0)), 0) / nT : 0);
        const extXp = med('xpMin') || 0, extGold = med('goldMin') || 0, extAb = med('killsMin') || 0;
        if (J.xpH != null && extXp > 0) { kXp = (J.xpH / 60) / extXp; fonte = 'jogo'; }
        if (J.ouroH != null && extGold > 0) { kOuro = (J.ouroH / 60) / extGold; }
        if (J.abatesH != null && extAb > 0) kAbates = (J.abatesH / 60) / extAb;
        cfg.kAbates = +kAbates.toFixed(3); jogo = cfg.medicaoJogo = { tem: true, xpH: J.xpH, ouroH: J.ouroH, abatesH: J.abatesH, dps: J.dps, fonte };
      }
    } catch { /* sem DOM: fica a estimativa */ }
    cfg.kXp = +kXp.toFixed(3); cfg.kOuro = +kOuro.toFixed(3); cfg.kReg = kReg;
    try {
      chrome.storage.local.get(STORAGE_KEY, (r) => {
        const cur = r?.[STORAGE_KEY] || {};
        chrome.storage.local.set({ [STORAGE_KEY]: { ...cur, automation: { ...(cur.automation || {}), kXp: cfg.kXp, kOuro: cfg.kOuro, kAbates: cfg.kAbates, kReg: cfg.kReg } } });
      });
    } catch { /* ignore */ }
    return { kXp: cfg.kXp, kOuro: cfg.kOuro, kAbates, kReg, fonte, jogo, n: ks.length, regioes: ks };
  }

  // =====================================================================================
  // O HUD DO JOGO E A FONTE — leitores dos numeros que O PROPRIO JOGO escreve no DOM
  // -------------------------------------------------------------------------------------
  // AGENTS.md REGRA N.o 3: "todo o numero que existe no jogo tem de ser LIDO, nunca copiado".
  // Ate aqui o motor da extensao re-estimava o que o jogo MEDE (kXp/kOuro no `calibrar`,
  // `player().vida` por regex de digitos, recargas so pelo `<em>` que some abaixo de 1 s).
  // Estes leitores pegam os numeros onde o jogo os poem — cada um com o file:linha que o escreve.
  // =====================================================================================

  /** Numero no formato DO ECRA do jogo. `fmt` (cena.js:225):
   *    n >= 1e6 -> (n/1e6).toFixed(1)+'M' · n >= 1e4 -> (n/1e3).toFixed(1)+'k' · senao Math.round(n)
   *  BUG MEDIDO: `#hud-vida-txt` (jogo.js:6203) usa este `fmt`, logo acima de 10.000 a string vem
   *  '12.3k / 20.4k' — e a regex antiga `(\d+)\s*\/\s*(\d+)` nao casava com o 'k', pelo que a
   *  vida do boneco caia no LITERAL 4188. Este parser e a mesma conta do `fmt`, invertida, com
   *  sufixo k/M e com `,` decimal (pt) ou `.` (en). */
  const numEcra = (txt) => {
    const norm = (g, suf) => {
      let s = /^\d{1,3}(\.\d{3})+$/.test(g) ? g.replace(/\./g, '') : g.replace(',', '.');
      let v = parseFloat(s);
      if (!Number.isFinite(v)) return null;
      if (/k/i.test(suf)) v *= 1e3;
      if (/M/i.test(suf)) v *= 1e6;
      return Math.round(v);
    };
    const m = String(txt == null ? '' : txt).trim().match(/^([\d.,]+)\s*([kKmM]?)$/);
    if (m) return norm(m[1], m[2]);
    // TOLERANTE: '9.876 / 12.3k' (o valor e o ULTIMO grupo) e 'Vale 5625 de ouro no Lojista.'
    const s2 = String(txt == null ? '' : txt).trim();
    if (!s2) return null;
    let ult = null; const re = /([\d.,]*\d[\d.,]*)\s*([kKmM]?)/g; let g;
    while ((g = re.exec(s2)) !== null) ult = g;
    return ult ? norm(ult[1], ult[2]) : null;
  };
  /** Valor de uma variavel CSS inline (`--cd`) que O JOGO escreve no elemento.
   *  jogo.js:6228 (recarga das habilidades) · jogo.js:6172 (buffs) · jogo.js:6190 (recarga de item).
   *  Le-se o valor INLINE (`el.style.getPropertyValue`), nao `getComputedStyle`: e exactamente
   *  o que a pagina acabou de escrever, sem depender da cascata. */
  const varCd = (el) => {
    try {
      const v = el && el.style && typeof el.style.getPropertyValue === 'function' ? el.style.getPropertyValue('--cd') : null;
      const n = v == null || v === '' ? null : parseFloat(String(v).trim());
      return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : null;
    } catch { return null; }
  };
  /** Texto de um elemento (sem rebentar se nao existir). */
  const txtEl = (el) => (el && el.textContent != null ? String(el.textContent) : '');

  /** VIDA do jogador tal como o HUD a escreve (jogo.js:6203):
   *    `${fmt(vida)} / ${fmt(vidaMax)}${escudo > 0 ? ` (+${fmt(escudo)})` : ''}`
   *  O `(+N)` e o ESCUDO ACTIVO (`d.escudo`, motor.js:2718, 1229, 2726) — era descartado.
   *  `vidaEff` = vida maxima + escudo: e a piscina que a sobrevivencia tem de usar. */
  function lerVidaHud() {
    const el = document.querySelector('#hud-vida-txt');
    const t = txtEl(el);
    const m = t.match(/([\d.,]+\s*[kKmM]?)\s*\/\s*([\d.,]+\s*[kKmM]?)/);
    const e = t.match(/\(\s*\+\s*([\d.,]+\s*[kKmM]?)\s*\)/);
    const max = m ? numEcra(m[2]) : null;
    const escudo = e ? (numEcra(e[1]) || 0) : 0;
    return { cur: m ? numEcra(m[1]) : null, max, escudo, vidaEff: (max == null ? null : max + escudo), txt: t };
  }

  /** Stats que o painel escreve por ID (nao ha rotulo por onde os pescar por texto):
   *    `#st-cdr`   −N%     jogo.js:6465 (`reducaoRecarga`, motor.js:537 — foco + itens, tecto 0,4)
   *    `#st-crit`  N%      jogo.js:6463 (`critico`, motor.js:541 — chance)
   *    `#st-critx` ×1,75   jogo.js:6464 (`danoCritico`, motor.js:499 base, +0,4 com 3031)
   *  A regex do `readStats` nao tinha rotulo de CDR e o critico era deitado fora. */
  function lerStatsId() {
    const um = (sel, re) => { const m = txtEl(document.querySelector(sel)).match(re); return m ? parseFloat(String(m[1]).replace(',', '.')) : null; };
    return {
      cdr: um('#st-cdr', /([\d.,]+)/),
      critico: um('#st-crit', /([\d.,]+)/),
      critDano: um('#st-critx', /([\d.,]+)/),
    };
  }

  /** RECARGA EXACTA de uma skill da barra. O `<em>` do HUD fica VAZIO abaixo de 1 s
   *  (jogo.js:6227: `seg = f > 0 && d.recargas[hk] >= 1 ? ... : ''`), e era esse `<em>` que o
   *  `cdDe()` convertia em 0 = PRONTA. A fraccao EXACTA esta em `--cd` (jogo.js:6228), no formato
   *  `falta / (recarga_base × (1 − CDR))` (jogo.js:6582 `fracRecarga`). Com o CDR do painel
   *  (`#st-cdr`, jogo.js:6465) recupera-se o segundo exacto: `frac × base × (1 − cdr)`. */
  function cdExatoHud(f, t, rank, cdr) {
    if (f == null || f <= 0) return 0;
    const k = KAT[t];
    const c = cdr == null ? (efeitosEquipados() || {}).cdr || 0 : cdr;
    // O rank vem do arsenal (`#hab-ativas .hab[data-t]`, jogo.js:5846 — sempre no DOM). Se ainda
    // nao estiver la, usa-se o rank 1, que e a recarga MAIS LONGA do kit: sobrestima o segundo,
    // nunca subestima — e devolve `aprox` para quem chamar saber que nao e exacto.
    const aprox = !(rank > 0);
    const base = (k && k.rec && rank) ? k.rec(rank) : (k && k.rec ? k.rec(1) : null);
    if (base == null) return { seg: null, aprox: true };
    return { seg: +(f * base * (1 - c)).toFixed(2), aprox };
  }

  /** EFEITOS ACTIVOS (`#hud-buffs`, jogo.js:6164-6177): um `<span class="hud-buff" data-t="K">`
   *  por efeito, com `<em>` = segundos que faltam (so acima de 1 s), `<b>` = acumulos (so acima
   *  de 1) e `--cd` = fraccao `1 − resta/duracao`. E o que diz se o PROXIMO golpe vai procar
   *  (Sede de Sangue, Sombra Pronta, Lich, Fluxo do Yasuo, Lamina Sinistra...). */
  function lerBuffs() {
    const out = [];
    for (const el of document.querySelectorAll('#hud-buffs .hud-buff')) {
      const t = el && el.dataset ? el.dataset.t : null;
      if (!t) continue;
      const em = txtEl(el.querySelector('em')).trim();
      const b = txtEl(el.querySelector('b')).trim();
      const seg = /^[\d.,]+$/.test(em) ? parseFloat(em.replace(',', '.')) : null;
      const acum = /^[\d.,]+$/.test(b) ? parseFloat(b.replace(',', '.')) : null;
      out.push({ t, seg, acum, frac: varCd(el) });
    }
    return out;
  }

  /** RECARGA DE ITEM (`#hud-equip > i`, jogo.js:6181-6193). O jogo desenha 7 itens com relogio:
   *  `--cd` = falta/duracao e `<em>` = segundos (ou 'Nm'). O `.hud-cd` so existe quando falta
   *  >= 0,05 s (jogo.js:6188). A ordem de `#hud-equip > i` e a de `equipNaOrdem()`
   *  (jogo.js:6092, 6184) — a MESMA do `#equip` que o `readEquip()` ja le (jogo.js:6621), logo o
   *  indice k dos dois e o mesmo item. A duracao fica documentada como fallback (jogo.js:6181). */
  const RECARGA_ITEM_FB = { 3157: 120, 3053: 90, 3026: 300, 3102: 40, 6655: 6, 3742: 4, 6631: 5 };   // jogo.js:6181
  function lerRecargaItens() {
    const els = [...document.querySelectorAll('#hud-equip > i')];
    if (!els.length) return [];
    let eq = [];
    try { eq = readEquip() || []; } catch { eq = []; }
    return els.map((el, k) => {
      const cd = el && el.querySelector ? el.querySelector(':scope > .hud-cd') : null;
      if (!cd) return null;
      const frac = varCd(cd);
      const em = txtEl(el.querySelector(':scope > em')).trim();
      const min = /^([\d.,]+)\s*m$/i.exec(em);
      let seg = null;
      if (min) seg = parseFloat(min[1].replace(',', '.')) * 60;          // 'Nm' (jogo.js:6191)
      else if (/^[\d.,]+$/.test(em)) seg = parseFloat(em.replace(',', '.'));
      const base = k < eq.length ? eq[k].base : null;
      const dur = (base && RECARGA_ITEM_FB[base]) || null;
      return { k, base, seg, frac, duracao: dur };
    }).filter(Boolean);
  }

  // ---------- O MEDIDOR DO JOGO (`analise`) — a AUTORIDADE em xp/h, ouro/h, abates/h e DPS ----
  // O jogo ja mede tudo isto desde que se abre: `novaAnalise` (jogo.js:523), `contarAnalise`
  // (jogo.js:525-537), `contasAnalise` (jogo.js:538-542), desenhado em `#janela-analise`
  // (jogo.js:544-560) e na linha SEMPRE VISIVEL `#rastreio-analise` (jogo.js:6250-6255).
  // A extensao re-estimava o mesmo por `kXp`/`kOuro` (`calibrar`) — estes numeros passam a ser a
  // AUTORIDADE e a estimativa fica so como fallback (quando o jogo ainda nao mediu).
  const _semAcentoHud = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  /** Le o que o jogo esta a desenhar AGORA. Nada e aberto nem clicado por esta funcao.
   *  `#rastreio-analise` esta sempre no DOM (fica `hidden` sem abates, jogo.js:6251) e da XP/h e
   *  ouro/h; `#janela-analise #analise-corpo` so e preenchido enquanto a janela esta aberta
   *  (jogo.js:565) e da tambem abates/h, DPS do ultimo minuto, maior golpe e loot por raridade. */
  function lerAnaliseJogo() {
    const vazio = { tem: false, xpH: null, ouroH: null, abatesH: null, dps: null, maior: null, chefes: null,
      itens: { basico: null, epico: null, lendario: null }, espolios: null, runas: null, mortes: null,
      fonte: {}, rast: null, janela: false, txtTempo: null };
    const ras = document.querySelector('#rastreio-analise');
    const tRas = txtEl(ras);
    const mxp = tRas.match(/([\d.,]+\s*[kKmM]?)\s*XP\s*\/\s*h/i);
    const mou = tRas.match(/([\d.,]+\s*[kKmM]?)\s*ouro\s*\/\s*h/i);
    const out = { ...vazio, itens: { ...vazio.itens }, fonte: {} };
    if (mxp) { out.xpH = numEcra(mxp[1]); out.fonte.xpH = 'jogo'; }
    if (mou) { out.ouroH = numEcra(mou[1]); out.fonte.ouroH = 'jogo'; }
    out.rast = ras ? { txt: tRas.trim(), visivel: !!(ras && ras.hidden === false) } : null;
    const jan = document.querySelector('#janela-analise');
    const corpo = document.querySelector('#analise-corpo');
    out.janela = !!(jan && jan.hidden === false && corpo);
    if (out.janela && corpo) {
      const cartao = (rot) => [...corpo.querySelectorAll('.an-cartao')].find((c) => _semAcentoHud(txtEl(c.querySelector('small'))) === rot) || null;
      const val = (rot) => { const c = cartao(rot); return c ? numEcra(txtEl(c.querySelector('b'))) : null; };
      const emTexto = (rot) => { const c = cartao(rot); return c ? txtEl(c.querySelector('em')) : ''; };
      const poe = (campo, rot) => { const v = val(rot); if (v != null) { out[campo] = v; out.fonte[campo] = 'jogo'; } };
      poe('xpH', 'xp por hora'); poe('ouroH', 'ouro por hora'); poe('abatesH', 'abates por hora'); poe('dps', 'dano por segundo');
      const maior = emTexto('dano por segundo').match(/maior golpe\s+([\d.,]+\s*[kKmM]?)/i);
      if (maior) { out.maior = numEcra(maior[1]); out.fonte.maior = 'jogo'; }
      const chefes = emTexto('abates por hora').match(/([\d.,]+)\s*chefes/i);
      if (chefes) { out.chefes = parseFloat(chefes[1].replace(',', '.')); out.fonte.chefes = 'jogo'; }
      for (const l of corpo.querySelectorAll('.an-linha')) {
        const rot = _semAcentoHud(txtEl(l.querySelector('span')));
        const v = numEcra(txtEl(l.querySelector('b')));
        if (v == null) continue;
        const mapa = { basicos: 'basico', epicos: 'epico', lendarios: 'lendario', espolios: 'espolios', runas: 'runas', mortes: 'mortes' };
        const campo = mapa[rot];
        if (campo) { if (campo in out.itens) out.itens[campo] = v; else out[campo] = v; out.fonte[campo] = 'jogo'; }
      }
      out.txtTempo = txtEl(corpo.querySelector('.an-tempo')).trim() || null;
    }
    out.tem = !!(out.xpH != null || out.ouroH != null || out.abatesH != null || out.dps != null);
    return out;
  }
  /** Lê os stats do personagem do painel (ficha). */
  function readStats() {
    const out = {};
    for (const e of document.querySelectorAll('.st')) {
      const t = e.textContent.replace(/\s+/g, ' ').trim();
      // ROUBO DE VIDA entra na leitura (pedido do Lead): e o stat que decide a luta contra o chefe
      // (cura so em AUTO-ATAQUES, motor.js:1226-1228) e o painel do jogo mostra-o.
      const m = t.match(/^(Dano|Armadura|Vel\. ataque|Res\. mágica|Poder|Mana|Crítico|Esquiva|Roubo de [Vv]ida)(.*)$/);
      // O painel escreve os valores com o `fmt` do jogo (jogo.js:6454-6460 `txt('#st-ad',
      // fmt(a.ad))`), logo "Dano 12.3k" e "Vida 4.188" chegam aqui. Sem o sufixo no grupo
      // (e sem a regra grupo-de-3 = milhar) o Dano acima de 10.000 era lido 1000x menor —
      // e o `player()/dpsPorHabilidade` inteiro trabalha com esse número.
      if (m) { const v = m[2].match(/([\d.,]+)\s*([kKmM])?/); out[m[1]] = v ? parseNum(v[1], v[2]) : 0; }
    }
    const sid = lerStatsId();
    if (sid.cdr != null) out.cdr = sid.cdr / 100;
    if (sid.critico != null) out.critChance = sid.critico / 100;
    if (sid.critDano != null) out.critMult = sid.critDano;
    return out;
  }

  /** AD BASE do campeao actual pelo kit do motor (motor.js:508 `ad = k.adBase + k.adNivel * g`,
   *  com `g = crescimento(nivel)`; motor.js:496-500 `PONTOS_POR_NIVEL`/MODELOS e o painel).
   *  O AD do painel ja vem com os itens e os %, por isso o BONUS e total - base. TK-02-149. */
  function adBaseCampeao(nivel) {
    const c = META.champAtual || META.champ || {};
    const adBase = Number(c.adBase);
    const adNivel = Number(c.adNivel);
    if (!Number.isFinite(adBase)) return null;
    if (!Number.isFinite(adNivel)) return adBase;
    const n = Math.max(1, Number(nivel) || 1);
    return adBase + adNivel * n;
  }
  function bonusAdDe(danoTotal, nivel) {
    const base = adBaseCampeao(nivel);
    if (base == null) return null;
    const tot = Number(danoTotal);
    if (!Number.isFinite(tot)) return null;
    return Math.max(0, tot - base);
  }
  /** Personagem actual no formato usado por avaliar().
   *  A vida agora vem do HUD com `fmt` k/M e o ESCUDO somado a vida efectiva; o `rv`, o critico e
   *  o CDR — que o painel do jogo escreve e eram deitados fora — passam a fazer parte do estado. */
  function player() {
    const s = readStats();
    const nivel = parseInt(document.querySelector('#hud-nivel')?.textContent || document.querySelector('#st-nivel')?.textContent || '0', 10) || 0;
    const hp = lerVidaHud();
    const sid = lerStatsId();
    const dano = s['Dano'] || 0;   // AD TOTAL do painel (motor.js:508 + itens); ver bonusAd
    // `va` = velocidade de ataque do HUD — usada como PISO de DPS quando nao ha historico medido
    // (dano × vel. ataque = DPS de auto-ataque). Antes so existia `dano`, e usar o DANO POR GOLPE
    // como se fosse DPS inflacionava qualquer valor de buff (ex.: a Respiracao do Vento).
    return {
      nivel,
      vida: hp.max != null ? hp.max : 4188, vidaCur: hp.cur, vidaAtual: hp.cur, escudo: hp.escudo, vidaEff: (hp.vidaEff != null ? hp.vidaEff : hp.max),
      armadura: s['Armadura'] || 0, rm: s['Res. mágica'] || 0, dano: s['Dano'] || 0, poder: s['Poder'] || 0, va: s['Vel. ataque'] || 0,
      // ROUBO DE VIDA (motor.js:538 `rouboVida`, aplicado em motor.js:1226-1228 `cura = dano × rv`):
      // era LIDO pelo `readStats` e DEITADO FORA pelo `player()`. Vale ~269 de cura/s numa base AD
      // (AGENTS.md, prova n.o 5) e decide a troca dano→sustento (docs/auditoria-do-jogo.md C8).
      // FRONTEIRA DE UNIDADE: o painel escreve o rv em PERCENTAGEM (jogo.js:5999 `['rv','Roubo de
      // Vida','%']`, jogo.js:6001 `numComp`) e o motor guarda-o como FRACCAO (motor.js:538;
      // motor.js:1227 `cura = dano * a.rouboVida`) — divide-se por 100 AQUI.
      rv: (s['Roubo de vida'] || s['Roubo de Vida'] || 0) / 100,
      // CRITICO (motor.js:541 chance; motor.js:499 base + 515 do 3031 = multiplicador): a build
      // AD/critico e 2,5–2,8x a de AP contra o chefe e nao entrava em conta nenhuma
      // (docs/auditoria-do-jogo.md item 7).
      critico: sid.critico != null ? sid.critico / 100 : (s['Crítico'] || 0) / 100,
      critDano: sid.critDano != null ? sid.critDano : 1.75,          // motor.js:499 (base)
      // CDR TOTAL do painel (motor.js:537: foco + itens, tecto 0,4) — a soma dos itens so nao chega.
      cdr: sid.cdr != null ? sid.cdr / 100 : null,
      // BONUS AD (motor.js:540 `bonusAd: ad - baseAd`): o AD que vem DOS ITENS e dos %. E o que
      // a HEMORRAGIA do Darius usa (motor.js:1652 `danoSangue = (13 + 0.3*adEfetivo.bonusAd + 4*nivel)/5`).
      // O painel da o AD TOTAL (motor.js:508 `ad = k.adBase + k.adNivel * g` + itens), por isso o
      // bonus e TOTAL menos o que o kit diz que e base. TK-02-149.
      bonusAd: bonusAdDe(dano, nivel),
      fonte: { vida: hp.max != null ? 'jogo:hud' : 'fallback', rv: s['Roubo de vida'] != null ? 'jogo:st' : 'ausente' },
    };
  }

  // Habilidades da Katarina (FALLBACK; o normal é vir do motor via META.kit).
  /** Fallback da tabela do motor (motor.js:1199) — usado só quando o META não a traz.
   *  REGRA N.o 3: o valor VIVO vem do META (`nivelDif`); isto é a rede de segurança documentada. */
  /** MIGRACOES DO CFG (ramo w10): cada entrada diz de que valor PARA que valor migrar. Nada e
   *  aplicado se o valor do dono for DIFERENTE do default velho (nunca se pisa uma escolha dele). */
  /** Versao do esquema do cfg (ramo w10) — gravada no arranque para a migracao ser ONE-SHOT. */
const CFG_VER = 1;
  const MIGRACOES_CFG = [
    { ver: 1, chave: 'barraPorDisponibilidade', de: false, para: true,
      porquê: 'default invertido false -> true (pedido do dono, 2026-10-14)' },
    { ver: 1, chave: 'autoRefino', de: false, para: true,
      porquê: 'a unica accao que nascia DESLIGADA era o refino; o dono mandou ligar por defeito' },
  ];

  const NIVEL_DIF_FB = { livre: 4, danoMonstro: 0.35, maxDanoMonstro: 5, danoJogador: 0.12, minDanoJogador: 0.25 };
  /** D14/D15 (Regra N.o 3): a TABELA efectiva — do RELAY (`META.nivelDif`) quando ele responde,
   *  senao a fotografia do motor (motor.js:1199). Devolve a tabela inteira, nao um escalar. */
  const nivelDifMotor = () => (META.nivelDif && typeof META.nivelDif === 'object') ? { ...NIVEL_DIF_FB, ...META.nivelDif } : NIVEL_DIF_FB;
  /** motor.js:1200 — diferença de nível EFECTIVA (desconta a faixa livre). É a base do fJ. */
  const difNivelMotor = (nivelAlvo, nivelJogador) => Math.max(0, (Number(nivelAlvo) || 0) - (Number(nivelJogador) || 1) - NIVEL_DIF_FB.livre);
  /** motor.js:1201 — o MONSTRO bem acima do nível bate mais forte (tecto maxDanoMonstro). */
  const fatorDanoMonstroMotor = (d) => d ? Math.min(NIVEL_DIF_FB.maxDanoMonstro, 1 + NIVEL_DIF_FB.danoMonstro * d) : 1;   // motor.js:1201 — recebe a DIFICULDADE
  /** motor.js:1202 — o JOGADOR contra monstro bem acima do nível: o dano DELE é reduzido (piso 0,25). */
  const fatorDanoJogadorMotor = (d) => d ? Math.max(NIVEL_DIF_FB.minDanoJogador, 1 - NIVEL_DIF_FB.danoJogador * d) : 1;   // motor.js:1202 — recebe a DIFICULDADE

  const KAT_FB = {
    Q: { max: 10, rec: (r) => 10 - 0.35 * (r - 1), base: (r) => 80 + 35 * (r - 1), ratio: (r) => 0.45 + 0.03 * (r - 1), mult: 3, alvo: '3 alvos', adaga: true },
    E: { max: 10, rec: (r) => 10 - 0.4 * (r - 1), base: (r) => 40 + 20 * (r - 1), ratio: (r) => 0.3 + 0.02 * (r - 1), adRatio: 0.4, mult: 1 },
    A: { max: 10, rec: (r) => 12 - 0.5 * (r - 1), base: (r) => 90 + 35 * (r - 1), ratio: (r) => 0.6 + 0.035 * (r - 1), mult: 1, adaga: true },
    T: { max: 10, rec: (r) => 24 - 0.8 * (r - 1), base: (r) => 60 + 28 * (r - 1), ratio: (r) => 0.4 + 0.03 * (r - 1), mult: 3, alvo: '3 adagas', adaga: true },
    R: { max: 5, rec: (r) => [75, 65, 55, 48, 42][r - 1], base: (r) => [30, 44, 58, 72, 86][r - 1], ratio: (r) => [0.25, 0.28, 0.31, 0.34, 0.37][r - 1], mult: 15, alvo: '15×3' },
    G: { max: 10, rec: (r) => 20 - 0.8 * (r - 1), base: (r) => 30 + 15 * (r - 1), ratio: (r) => 0.3 + 0.015 * (r - 1), mult: 1, auto: true },
    F: { max: 10, rec: (r) => 16 - 0.5 * (r - 1), base: (r) => 40 + 18 * (r - 1), ratio: () => 0.25, mult: 1, dot: true },
    W: { max: 10, rec: (r) => 14 - 0.4 * (r - 1), adaga: true },
    D: { max: 10, passiva: true },
    B: { max: 10, util: true },
    M: { max: 10, rec: (r) => 14 - 0.5 * (r - 1), base: (r) => 200 + 80 * (r - 1), ratio: (r) => 1.2 + 0.07 * (r - 1), mult: 1 },
  };
  let KAT = KAT_FB;
  let _giro = { base: 30, nivel: 19, ap: 1, ad: 0.4 };   // coeficientes da Voracidade (motor)

  // ============ VORACIDADE POR ABATE (Katarina) — a mecânica que faltava ============
  //  motor.js:736   `P: { voracidade: 1.5, voracidadeChefe: 5, curaBase: 0.05, ... }`
  //  motor.js:1789  `if (HPk?.voracidade) for (const t of ['Q','W','E'])
  //                    d.recargas[t] = Math.max(0, d.recargas[t] - (i.chefe ? HPk.voracidadeChefe : HPk.voracidade));`
  //  motor.js:2169  `cura = (HP.curaBase || 0) + (HD?.curaGiro && rD ? HD.curaGiro[rD-1] : 0)` + 2170 cura
  //
  //  MEDIDO (docs/auditoria-do-jogo.md C3): num farm a 25 abates/min a recarga efectiva da Q, W e E
  //  fica x1,63 mais rapida que a recarga crua — e a extensao calculava `dps = total / cd` com o
  //  cd CRU (automation.js:1415, versao anterior). Falta tambem a CURA do giro.
  //
  //  LACUNA DECLARADA do inject.js: o `serialKit` (inject.js:113-115) reencaminha 22 campos da
  //  habilidade e `voracidade`/`voracidadeChefe`/`curaBase` NAO estao na lista, logo o motor nao
  //  os manda. O `curaGiro` (motor.js:755-756) ESTA na lista e e lido do kit. Os tres primeiro
  //  ficam aqui com o file:linha enquanto o inject nao os reencaminhar (REGRA N.o 3 do AGENTS.md).
  const VORACIDADE_FB = {
    katarina: { voracidade: 1.5, voracidadeChefe: 5, curaBase: 0.05, hab: ['Q', 'W', 'E'] },   // motor.js:736 + 1789
  };
  /** A Voracidade do campeão actual (ou null se não tiver). */
  function voracidadeDe() {
    const id = (META.champAtual && META.champAtual.id) || (META.champ && META.champ.id) || null;
    const v = (id && VORACIDADE_FB[id]) || null;
    if (!v) return null;
    return { valor: v.voracidade, chefe: v.voracidadeChefe, hab: v.hab || ['Q', 'W', 'E'], curaBase: v.curaBase };
  }
  /** Cura do GIRO das adagas (motor.js:2169-2170): `curaBase + curaGiro[rank-1]` do dano do giro.
   *  O `curaBase` (motor.js:736) nao vem do inject; o `curaGiro` vem do kit (motor.js:755-756). */
  function curaGiroDe() {
    const P_ = KAT.P || {}, D_ = KAT.D || {};
    // RANK REAL da D (motor.js:2183 `rD = estado.ranks.D`): a `curaGiro` e uma serie por rank
    // (motor.js:768, 8% no rank 1 -> 17% no rank 10). Antes era `D_.curaGiro(1)` — rank 1
    // hardcoded, logo a Katarina com a D a rank 7 via 8% em vez de 14% (TK-02-130).
    let cg = null;
    if (typeof D_.curaGiro === 'function') {
      const rD = rankKitDe('D');
      cg = rD ? D_.curaGiro(rD) : D_.curaGiro(1);
    }
    const base = P_.curaBase != null ? P_.curaBase : 0;
    if (!base && !cg) return { cura: 0, tem: false };
    return { cura: base + (cg || 0), tem: true };
  }
  /** CURA POR SEGUNDO do giro das adagas (motor.js:2188-2193): o dano do giro X a fracao
   *  `curaBase + curaGiro[rank]`. E a cura PROPRIA da Katarina (AGENTS.md, prova n.o 7) e
   *  entra na sobrevivencia (o criterio do dono: quantas pocoes / quanto custa).
   *  Sem skill de adaga no arsenal devolve 0 (nao ha giro, nao ha cura). */
  function curaGiroS() {
    try {
      const cg = curaGiroDe();
      if (!cg.tem) return 0;
      const d = dpsPorHabilidade();
      const g = d && d.curaGiro;
      return (g && g.tem && Number.isFinite(g.porSegundo)) ? g.porSegundo : 0;
    } catch { return 0; }
  }
  /** Abates por minuto MEDIDOS ao vivo — a extensao ja os conta (`killTimes` enchido pelo
   *  `handleLog`, automation.js:733-800) e o `analisarWaves` (automation.js:620-638) deriva o
   *  `killsMin` disso. E a cadencia de abates que a Voracidade precisa. Ordem: a wave viva,
   *  depois o historico agregado. Sem medida, null (e a Voracidade nao entra — nao se inventa). */
  function killsMinAoVivo() {
    const base = (() => {
      try { const w = analisarWaves(); if (w && w.killsMin) return w.killsMin; } catch { /* ignore */ }
      try { const r = ritmoMobs(); if (r && r.killsMin) return r.killsMin; } catch { /* ignore */ }
      try { for (const a of (agregar() || [])) if (a.killsMin) return a.killsMin; } catch { /* ignore */ }
      return null;
    })();
    // ---- LARVAS DO BARAO (motor.js:3141-3142) CONTAM COMO ABATES (TK-02-148) ---------------
    // motor.js:1811 corta 1,5 s da recarga da Q/W/E por cada abate, e o corte NAO tem guarda
    // `i.invocado` (ao contrario da tarefa, motor.js:1808). As larvas do Barao nao dao loot
    // (motor.js:1792) e por isso nao passam pelo log — o `base` acima nao as ve.
    // Ciclo do rodizio (motor.js:3089/:3099/:3103): invocar 2 larvas e 1 de 3 mecanicas; com
    // `(0+14)+(1,3+9)+(1+9) = 34,3 s` por volta, sao 2 x (60/34,3) = 3,5 larvas por minuto,
    // mais o proprio Barao (0,25/min). Na pratica: a fracao das larvas nos abates da luta e
    // (3,5)/(3,5+0,25) = 93% — a Voracidade corta MUITO mais do que o `base` diz.
    // So se soma quando ha larvas registadas nesta fase (o chefe estar activo).
    // Janela deslizante propria: 90 s (2,6 voltas do rodizio de 34,3 s) — o que passa dela ja
    // nao conta para a cadencia AGORA. Larvas antigas caiem fora (e o array nao cresce sem fim).
    const agora = Date.now();
    while (_larvasInvoca.length && agora - _larvasInvoca[0].at > LARVAS_JANELA_MS) _larvasInvoca.shift();
    if (!_larvasInvoca.length) return base;
    const larvasNaJanela = _larvasInvoca.reduce((s, l) => s + (l.n || 0), 0);
    const larvasMin = (larvasNaJanela / (LARVAS_JANELA_MS / 60000));
    if (base == null) return larvasMin > 0 ? larvasMin : null;
    return base + larvasMin;
  }
  /** RECARGA EFECTIVA com a Voracidade: `C' = C / (1 + v/T)`, com T = segundos por abate.
   *  Derivacao de motor.js:1789 (cada abate tira `v` da recarga): num ciclo de recarga C com
   *  abates a cada T segundos, a recarga encolhe v x (C'/T) -> C'(1 + v/T) = C.
   *  Tabela de docs/auditoria-do-jogo.md C3: 10/min -> x1,25 · 15 -> x1,38 · 20 -> x1,50 ·
   *  25 -> x1,63 · 30 -> x1,75. So Q, W e E (motor.js:1789). */
  function cdVoraz(cd, t, km) {
    if (!(cd > 0)) return cd;
    const v = voracidadeDe();
    if (!v || v.hab.indexOf(t) < 0) return cd;
    const k = km != null ? km : killsMinAoVivo();
    if (!(k > 0)) return cd;
    return cd / (1 + v.valor / (60 / k));
  }
  /** RECARGA EFECTIVA SEGUNDO O MOTOR (corte DIRECTO por abate, motor.js:1811).
   *  `d.recargas[t] = Math.max(0, d.recargas[t] - (i.chefe ? v : voracidade))` — cada abate
   *  tira `v` da recarga, e a recarga continua a contar por baixo. Se 3 abates caem
   *  dentro da recarga, a conta e DIRECTA: `C - n*v`, e nao `C/(1+v/T)`.
   *  A aproximacao do `cdVoraz` (regime estacionario) serve de limite inferior: ela
   *  assume um abate a cada T e so CONTA os abates que cabem no ciclo alongado — quando os
   *  abates sao mais frequentes do que a recarga, o motor vai a zero muito antes.
   *  MEDIDO (TK-02-148, ticket): Q no rank 10 com 23% de CDR = 6,85 x 0,77 = 5,24 s; com 3
   *  abates a cortar 1,5 s cada, o motor da 5,24 - 4,5 = 0,74 s. A extensao dizia 5,24 s —
   *  a taxa de lancamento estava subestimada 7,1x.
   *  Aqui: com `abatesNaRecarga` (>= 0, default calculado de km) a recarga efectiva e
   *  `max(0, C - n*v)`; se o resultado da <= 0 a habilidade fica SEMPRE pronta (o motor
   *  nao deixa a recarga passar de zero).
   *  Uso: relatorio/decissao; o `cdVoraz` continua a ser o que alimenta o DPS (limite
   *  conservador e estavel). */
  function cdVorazMotor(cd, t, km, abatesNaRecarga) {
    if (!(cd > 0)) return cd;
    const v = voracidadeDe();
    if (!v || v.hab.indexOf(t) < 0) return cd;
    let n = abatesNaRecarga;
    if (n == null) {
      const k = km != null ? km : killsMinAoVivo();
      // quantos abates cabem na recarga crua: floor(C/T) (o motor corta por abate ocorrido)
      n = (k > 0) ? Math.floor(cd / (60 / k)) : 0;
    }
    if (!(n > 0)) return cd;
    const r = Math.max(0, cd - n * v.valor);
    if (r <= 0) return 0;      // sempre pronta: a Voracidade cobre a recarga toda
    return r;
  }


  // ============ HEMORRAGIA DO DARIUS (TK-02-149) ============
  // O Darius e o UNICO campeao com `hemorragia: true` (motor.js:883). A passiva aplica
  // ACUMULOS no alvo e eles queimam vida por segundo:
  //   motor.js:1291-1299 `aplicarHemorragia`: 5 acumulos, `tSangue = 5` s; ao chegar a 5
  //     liga `c.darius.poder = 5` (o Poder de Noxus).
  //   motor.js:1652 `const danoSangue = (13 + 0.3 * adEfetivo.bonusAd + 4 * estado.nivel) / 5;`
  //   motor.js:1667 `const dano = mitigar(danoSangue * i.acumulos * dt, i.armadura * (1 - a.penArmadura));`
  //   motor.js:1345-1351 `efetivo`: com `d.poder` ligado o AD leva
  //     `bonusPoder(nivel) = 30 + 200*(min(n,18)-1)/17 + 4*max(0,n-18)` a mais.
  // A extensao nao tinha UMA referencia a nada disto: zero.
  /** Poder de Noxus (motor.js:1351): o AD que o Darius ganha enquanto o poder esta ligado. */
  function bonusPoderDe(nivel) {
    const n = Math.max(1, Number(nivel) || 1);
    return 30 + (200 * (Math.min(n, 18) - 1)) / 17 + 4 * Math.max(0, n - 18);
  }
  /** Dano POR ACUMULO POR SEGUNDO da hemorragia, antes de mitigar (motor.js:1652).
   *  `bonusAd` = AD de bonus do personagem (itens + %, motor.js:540 `bonusAd: ad - baseAd`).
   *  Com o Poder de Noxus ligado o motor usa o `adEfetivo` (motor.js:1348), onde o
   *  `bonusPoder` entra no `ad` e nao no `bonusAd`: o DOT nao cresce com
   *  o bonusPoder, mas o RESTO do dano cresce (ver `hemorragiaDe`). */
  function danoSangueDe(nivel, bonusAd) {
    const b = Math.max(0, Number(bonusAd) || 0);
    return (13 + 0.3 * b + 4 * (Number(nivel) || 1)) / 5;
  }
  /** HEMORRAGIA completa do campeao actual (ou null se nao for o Darius).
   *  Devolve: porAcumulo (dano/s por acumulo, sem mitigar), acumulos (5),
   *  duracao (5 s, motor.js:1294), bruto (porAcumulo x acumulos) e
   *  dps (o bruto mitigado pela armadura do alvo, com a pen de armadura). */
  function hemorragiaDe(nivel, bonusAd, alvo) {
    const kit = (META.kits && META.champAtual && META.kits[META.champAtual.id]) || null;
    const ehDarius = kit ? !!kit.hemorragia : !!(META.champAtual && META.champAtual.id === 'darius');
    if (!ehDarius) return null;
    const porAcumulo = danoSangueDe(nivel, bonusAd);
    const acumulos = 5;                      // motor.js:1293
    const duracao = 5;                       // motor.js:1294
    const bruto = porAcumulo * acumulos;
    let dps = bruto;
    if (alvo && Number.isFinite(alvo.armadura)) {
      const pen = (alvo.penArmadura != null ? alvo.penArmadura : null);
      const arm = pen != null ? alvo.armadura * (1 - pen) : alvo.armadura;
      dps = bruto * (100 / (100 + Math.max(0, arm)));
    }
    return { porAcumulo: +porAcumulo.toFixed(2), acumulos, duracao, bruto: +bruto.toFixed(2), dps: +dps.toFixed(2) };
  }
  /** Campeão atual, detectado pelo caminho do ícone da skill (#hud-habs). */
  function detectarCampeao() {
    // FONTE PRIMARIA: o retrato do HUD traz "<champ>:<skin>" (ex.: 'yasuo:0').
    // BUG CORRIGIDO: a deteccao só olhava o ícone da habilidade e, quando ele
    // ainda nao existia (a deteccao corre UMA vez, no arranque), caía no fallback
    // HARDCODED 'katarina'. Resultado medido com o Yasuo em campo:
    // identidadeCampeao().champ.id = 'katarina' e magia=true -> TODA a build,
    // valoração de item e decisao de equip eram calculadas para uma maga AP
    // enquanto o boneco era AD. buildIdeal() devolvia Rabadon/Void Staff.
    try {
      const q = (document.querySelector('#hud-retrato') || {}).dataset?.qual || '';
      const idRetrato = String(q).split(':')[0].trim().toLowerCase();
      if (idRetrato && META.kits && META.kits[idRetrato]) return idRetrato;
    } catch { /* ignore */ }
    try {
      const img = document.querySelector('#hud-habs img, #hud-habs .hud-hab img, [src*="/habilidades/"]');
      const m = img && /\/habilidades\/([a-z]+)\//i.exec(img.getAttribute('src') || img.src || '');
      if (m && META.kits && META.kits[m[1]]) return m[1];
    } catch { /* ignore */ }
    // NAO inventar 'katarina': sem certeza devolve null e quem chama decide.
    return (META.champAtual && META.champAtual.id) || (META.champ && META.champ.id) || null;
  }
  /** Re-detecta o campeao e reaplica o kit quando ele MUDA. Antes a deteccao
   *  corria só no arranque: se o HUD ainda nao estivesse pronto, ficava errado
   *  para sempre. Agora e auto-corretivo (chamado pelo loop). */
  function garantirCampeao() {
    try {
      const id = detectarCampeao();
      if (id && (!META.champAtual || META.champAtual.id !== id)) {
        const antes = META.champAtual && META.champAtual.id;
        aplicarKit();
        logEvent('campeao', { id, antes: antes || null, corrigido: !!antes });
        return true;
      }
    } catch { /* ignore */ }
    return false;
  }
  /** Constrói o KAT a partir do kit do MOTOR (do campeão atual) — arrays por rank. */
  function aplicarKit() {
    const id = detectarCampeao();
    const fonte = (META.kits && META.kits[id]) || (META.kit ? { kit: META.kit, adBase: META.champ && META.champ.adBase, adNivel: META.champ && META.champ.adNivel, magia: META.champ && META.champ.magia, semMana: META.champ && META.champ.semMana, adagas: META.champ && META.champ.adagas, distancia: META.champ && META.champ.distancia, papel: META.champ && META.champ.papel, giroSrc: null, hemorragia: META.champ && META.champ.hemorragia } : null);
    if (!fonte || !fonte.kit) { KAT = KAT_FB; return; }
    const serie = (a) => (Array.isArray(a) ? ((r) => a[Math.max(0, Math.min(a.length - 1, (r || 1) - 1))]) : null);
    const out = {};
    for (const t of Object.keys(fonte.kit)) {
      const h = fonte.kit[t] || {};
      // Campos do kit que o `serialKit` do inject.js (inject.js:136-151) reencaminha: o filtro
      // Agora passa TODOS os campos primitivos (arrays de números incluidos), portanto `pen`,
      // `curaBase`, `curaGiro`, `vaAdaga` e `voracidade`/`voracidadeChefe` chegam AQUI.
      // O `aplicarKit` é que os deitava fora: nao estavam nesta lista (defeito medido — ver
      // `penKitDe`, `curaGiroDe` e `voracidadeDe`).
      out[t] = { alvos: h.alvos != null ? h.alvos : null, max: h.max, mult: h.mult, alvo: h.alvo, adaga: !!h.adaga, auto: !!h.auto, dot: !!h.dot, passiva: !!h.passiva, util: !!h.util, adRatio: h.adRatio,
        base: serie(h.base), ratio: serie(h.ratio), rec: serie(h.recarga), nivel: h.nivel,
        duracao: h.duracao, duracaoPen: h.duracaoPen, penSuspiro: h.penSuspiro,
        va: serie(h.va), bonus: serie(h.bonus), bonusHab: serie(h.bonusHab),
        // ---- kit passivo / penetração / cura (motor.js:529 `penE`, 552 `penArmadura`) ----
        // `pen` = penetração de armadura POR RANK da habilidade (só o E do Darius a tem,
        // motor.js:573: 0,20 no rank 1 -> 0,45 no rank 10). O MOTOR aplica-a sempre
        // (atributos, motor.js:529 -> 552); a matemática de build ignorava-a.
        pen: serie(h.pen),
        // Voracidade/cura do giro da Katarina (motor.js:749-750 P; 768 D).
        curaBase: h.curaBase, curaGiro: serie(h.curaGiro), vaAdaga: serie(h.vaAdaga),
        voracidade: h.voracidade, voracidadeChefe: h.voracidadeChefe,
        acumMax: h.acumMax, duracaoSinistra: h.duracaoSinistra };
    }
    KAT = out;
    META.champAtual = { id, adBase: fonte.adBase, adNivel: fonte.adNivel, magia: !!fonte.magia, semMana: !!fonte.semMana, adagas: !!fonte.adagas, distancia: !!fonte.distancia, papel: fonte.papel || null, hemorragia: !!fonte.hemorragia };
    // coeficientes da Voracidade, lidos do fonte da função do motor (P.giro)
    const src = fonte.giroSrc || '';
    const num = (re, d) => { const m = src.match(re); return m ? parseFloat(m[1]) : d; };
    _giro = { base: num(/=>\s*([\d.]+)/, 30), nivel: num(/([\d.]+)\s*\*\s*nivel/, 19), ap: num(/([\d.]+)\s*\*\s*(?:apDe|a\.ap|poder)/, 1), ad: num(/([\d.]+)\s*\*\s*Math\.max/, 0.4) };
  }

  /** ============ PENETRACAO DO KIT (TK-02-114) ============
   *  O MOTOR aplica a penetracao de armadura que vem do KIT, sempre ligada, por rank:
   *    motor.js:529  `const penE = k.hab.E.pen && estado.ranks.E ? k.hab.E.pen[estado.ranks.E - 1] : 0;`
   *    motor.js:552  `penArmadura: 1 - (1 - penE) * (tem('3036') ? 0.7 : 1)`
   *  ha UM UNICO `pen:` em todo o game-src: o E do DARIUS (motor.js:573,
   *  `pen: [0.2, 0.23, 0.26, 0.29, 0.32, 0.35, 0.38, 0.41, 0.43, 0.45]` = 20% no rank 1,
   *  45% no rank 10). A Katarina NAO tem (kit-katarina-vivo.json: 0 ocorrencias de "pen").
   *  A matematica de build (statsSet/estimarSet/scoreSet/valorBuff) ignorava-a: sobrevalorizava
   *  o Cajado do Vazio e todos os itens de pen em qualquer campeao que a tenha no kit.
   *  REGRA N.o 3: o numero vem do KIT (lido do jogo), nunca copiado para aqui. */
  function penKitDe(t, rank) {
    const k = (typeof KAT === 'object' && KAT) ? KAT[t] : null;
    const f = k && typeof k.pen === 'function' ? k.pen : null;
    if (!f) return 0;
    const r = Math.max(1, Math.round(Number(rank) || 1));
    const v = f(r);
    return Number.isFinite(v) ? Math.max(0, v) : 0;
  }
  /** Rank actual de uma habilidade, lido do arsenal (#hab-ativas .hab[data-t], jogo.js:5846) —
   *  o MESMO elemento e a MESMA regex que o `readSkills` usa para `arsenal[].rank`,
   *  isto é, o numero que o motor guarda em `estado.ranks`. Sem arsenal (o rank ainda nao
   *  veio) devolve null e quem chama decide: a pen do kit nao entra (nao se inventa rank).
   *  LIDO AQUI E NAO PELO `readSkills` DE PROPOSITO: `efeitosEquipados` -> `penKitCampeao` ->
   *  `readSkills` -> `efeitosEquipados` e um CICLO (o `readSkills` chama o
   *  `efeitosEquipados` para o CDR quando o painel nao esta la). A query directa quebra-o.
   *  Medido: com o ciclo, a suite `regras` passou de 79 ms para 858 ms. */
  function rankKitDe(t) {
    try {
      for (const h of document.querySelectorAll('#hab-ativas .hab[data-t]')) {
        const tt = (h && h.dataset) ? h.dataset.t : null;
        if (tt !== t) continue;
        const m = (h && h.textContent ? String(h.textContent) : '').match(/(\d+)\s*\/\s*(\d+)/);
        if (m && +m[1] > 0) return +m[1];
      }
    } catch { /* ignore */ }
    return null;
  }
  /** Penetracao de armadura do kit do campeao actual, por rank, para a habilidade `t`.
   *  0 quando o campeao nao tem pen no kit (7 campeoes: 6 nao tem) ou quando o rank ainda nao
   *  foi lido (nao se inventa rank). */
  function penKitCampeao(t) {
    const tt = t || 'E';
    const rk = rankKitDe(tt);
    return rk ? penKitDe(tt, rk) : 0;
  }

  /** Dano e DPS por habilidade (nível atual), a partir do motor + stats do personagem.
   *  As habilidades que deixam ADAGA (Q/W/A/T) também disparam a Voracidade (giro) ao pegar. */
  /** CDR (redução de recarga) somada dos itens equipados, lida do texto da passiva. */
  /** Lê o TOOLTIP (data-dica) do item: stats REAIS (já com refino + qualidade) + passivas. */
  function parseDica(dica) {
    const t = dica || '';
    const f = (m) => m ? parseFloat(String(m[1]).replace(/\./g, '').replace(',', '.')) : 0;
    const d = (m) => m ? parseFloat(String(m[1]).replace(',', '.')) : 0;
    return {
      ap: d(t.match(/\+([\d.,]+)\s*poder de habilidade/i)),
      ad: d(t.match(/\+([\d.,]+)\s*dano de ataque/i)),
      vida: f(t.match(/\+([\d.,]+)\s*vida/i)),
      mana: f(t.match(/\+([\d.,]+)\s*mana/i)),
      armadura: f(t.match(/\+([\d.,]+)\s*armadura/i)),
      rm: f(t.match(/\+([\d.,]+)\s*res\.?\s*mágica/i)),
      cdr: d(t.match(/[−-]\s*([\d.,]+)\s*%\s*recarga/i)) / 100,               // linha de stats (JÁ inclui o refino)
      penMag: d(t.match(/([\d.,]+)\s*%\s*de\s*penetração\s*mágica/i)) / 100,
      apPct: d(t.match(/Poder de Habilidade total em\s*([\d.,]+)\s*%/i)) / 100,
      lich: d(t.match(/\+([\d.,]+)\s*%\s*do\s*Poder de Habilidade/i)) / 100,
      refino: +(t.match(/refinado\s*\+?(\d+)/i)?.[1] || 0),
      qual: (t.match(/Qualidade\s*([A-Z]{1,2})/i) || [])[1] || null,
    };
  }

  /** Efeitos somados dos itens EQUIPADOS (tooltip = refino + qualidade aplicados).
   *  `ids` OPCIONAL (correcção do Lead, 2026-10-14 — MEDIDO ao vivo: a função NÃO aceitava
   *  argumento nenhum e o JS descartava-o em silêncio, logo `efeitosEquipados(['3171'])` e
   *  `efeitosEquipados(['3175'])` devolviam AMBOS o equipamento do dono — cdr 0,23 / pen 0,55 —
   *  e qualquer análise de build media o personagem equipado em vez da build pedida).
   *  Com `ids`, calcula a partir DESSA lista: '3175~A' / '4629+3~A' trazem qualidade e refino e
   *  são escalados como o motor faz (motor.js:252 `m = (1 + BONUS_REFINO*ref) * QUALIDADES[qual].mult`,
   *  BONUS_REFINO 0.12 motor.js:55). Um id CRU (sem ~QUAL/+N) assume qualidade B e refino 0.
   *  A resolução id -> stats REUTILIZA o `statsSet` (o mesmo que o `estimarSet`/`scoreSet` usam),
   *  para não haver duas tabelas de pen/CDR a divergir. Sem `ids`, lê `readEquip()` como sempre —
   *  os chamadores sem argumento (`cdrEquipado`, `dpsPorHabilidade`, `estimarSet`, `scoreSet`) não mudam. */
  function efeitosEquipados(ids) {
    if (Array.isArray(ids)) {
      // `parseSlotId` é o ÚNICO intérprete de '<base>+<refino>~<qual>' (o `statsSet` usa o mesmo)
      // e devolve já o `mult` do motor (motor.js:252).
      const itens = ids.map((raw) => {
        const p = parseSlotId(raw);
        const base = p.base, qual = p.qual, refino = p.refino, mult = p.mult;
        const S = statsSet([base], { mult });
        // O `statsSet` só escala ap/ad pelo `mult` — o motor escala TUDO (motor.js:252-255:
        // ad/ap/mana/vida/armadura/rm/va/rv/critico/regen/**cdr**). Aqui o cdr/pen levam o `mult`
        // para a qualidade/refino contarem como no jogo ('3175~A' -> pen 0.15*1.15 = 0.1725).
        // O `statsSet` JÁ aplica o `mult` (qualidade/refino) ao cdr/pen desde que passou a usar o
        // `parseSlotId` — NÃO multiplicar outra vez aqui (era contagem dupla).
        // `penArmaduraItens` = a pen dos ITENS sozinha (o `statsSet` ja lhes encadeia a do
        // KIT, TK-02-114); aqui a do KIT entra UMA vez no conjunto, nao uma vez por item.
        return { base, qual, refino, cdr: S.cdr, penMag: S.pen, penArmadura: S.penArmadura || 0,
          penArmaduraItens: S.penArmaduraItens != null ? S.penArmaduraItens : (S.penArmadura || 0),
          apPct: (S.det || []).some((d) => /Rabadon/.test(d)) ? 0.35 : 0,
          lich: S.lich, ap: S.ap, ad: S.ad, efeito: ((META.itens || []).find((x) => String(x.id) === base) || {}).efeito || null };
      });
      const soma = (k) => itens.reduce((t, x) => t + (x[k] || 0), 0);
      // motor.js:552 `penArmadura: 1 - (1 - penE) * (tem('3036') ? 0.7 : 1)` — penE = a do KIT.
      const penItens = Math.max(0, Math.min(1, soma('penArmaduraItens')));
      const penKit = penKitCampeao('E');
      return { cdr: Math.min(CAP_CDR, soma('cdr')), penMag: Math.min(CAP_PEN_MAG, soma('penMag')),
        penArmadura: 1 - (1 - penKit) * (1 - penItens), penArmaduraItens: penItens, penKit, apPct: soma('apPct'),
        lich: itens.reduce((m, x) => Math.max(m, x.lich || 0), 0), apItens: soma('ap'), itens };
    }
    let cdr = 0, penMag = 0, penArm = 0, apPct = 0, lich = 0, apItens = 0; const itens = [];
    for (const e of readEquip()) {
      const s = e.stats || parseDica(e.dica);
      cdr += s.cdr || 0; penMag += s.penMag || 0; apPct += s.apPct || 0; lich = Math.max(lich, s.lich || 0); apItens += s.ap || 0;
      // PEN DE ARMADURA do 3036 (motor.js:539): o `parseDica` le o TEXTO da passiva e nao tem
      // campo de pen de armadura, pelo que a 3036 valia 0 neste caminho — o ramo com `ids`
      // (statsSet) sempre a viu. Medido: 30% de pen a faltar NUM item que a build AD poe.
      if (String(e.base) === '3036') penArm = Math.max(penArm, 0.3);
      itens.push({ base: e.base, nome: e.nome, refino: e.refino, qual: e.qual, ...s });
    }
    // CDR do PAINEL manda (motor.js:537): o painel escreve `reducaoRecarga` = foco + itens, com o
    // tecto de 0,4. A soma dos itens NAO inclui o foco (0,4% por ponto de Foco, motor.js:537),
    // pelo que um boneco com 10 de foco tem 4% de CDR que esta soma nao via.Quando o painel nao
    // esta la (banco de testes), fica a soma dos itens.
    const cdrPainel = (player() || {}).cdr;
    if (cdrPainel != null) cdr = cdrPainel;
    // PEN DE ARMADURA DO KIT (motor.js:529 -> 552): o caminho sem `ids` e o que o jogo real usa
    // (`dpsPorHabilidade`, `avaliar`, `mitSaida`). A penetracao da E do Darius (20%->45% por
    // rank) entra aqui uma vez, encadeada com a dos itens (3036 = 0,3, motor.js:539).
    const penKit = penKitCampeao('E');
    return { cdr: Math.min(CAP_CDR, cdr), penMag: Math.min(CAP_PEN_MAG, penMag),
      penArmadura: 1 - (1 - penKit) * (1 - penArmaduraDe(penArm)), penArmaduraItens: penArmaduraDe(penArm), penKit, apPct, lich, apItens, itens };
  }
  const cdrEquipado = () => efeitosEquipados().cdr;

  /** `ranksOverride` = { t: rank } para calcular NUM RANK diferente do actual (ver `dpsRank`). */
  function dpsPorHabilidade(ranksOverride) {
    const p = player(); const sk = readSkills();
    const ap = p.poder || 0, ad = p.dano || 0;
    const ef = efeitosEquipados();
    const cdr = ef.cdr, lich = ef.lich;                        // −% recarga (tooltip, já c/ refino) e +%AP por skill (Lich)
    const adBase = (META.champAtual && META.champAtual.adBase) || (META.champ && META.champ.adBase) || 58;   // base de AD do campeão (motor)
    const g = _giro;
    const giro = Math.round(g.base + g.nivel * p.nivel + g.ap * ap + g.ad * Math.max(0, ad - adBase));   // Voracidade (passiva, motor)
    const out = [];
    let giroDps = 0, lichDps = 0; const adagas = [];   // DPS da Voracidade = giro × (procs das skills de adaga)
    for (const h of (sk.arsenal || [])) {
      const k = KAT[h.t]; if (!k) continue;
      if (k.passiva) continue;
      const temAdaga = !!k.adaga;
      const rr = (ranksOverride && ranksOverride[h.t] != null) ? ranksOverride[h.t] : h.rank;   // rank a calcular
      // ESCALA DO `ratio` — o motor diz qual é (motor.js:923 `efeitosRank`):
      //   `h.escalaPoder ? 'do Poder de Habilidade' : h.ratio ? 'do dano' : ...`
      // e `escalaPoder` é posto nos campeões de MAGIA (motor.js:670 Lux, motor.js:772 Katarina,
      // motor.js:815 Taric, motor.js:857 Zac). Nos campeões AD (Yasuo/Darius/Ezreal) o `ratio`
      // escala com o DANO DE ATAQUE. BUG MEDIDO: esta linha multiplicava o `ratio` por `ap`, que
      // num campeão AD é ZERO — todo o escalamento do Yasuo era multiplicado por zero e o DPS
      // saía ~10x abaixo do real (a MESMA correcção já tinha sido feita no `estimarSet`).
      const escala = (META.champAtual && META.champAtual.magia) ? ap : ad;
      const direto = (k.base && rr) ? k.base(rr) + (typeof k.ratio === 'function' ? k.ratio(rr) : k.ratio) * escala + (k.adRatio || 0) * ad : 0;
      const dano = direto + (temAdaga ? giro : 0);
      const mult = k.mult || 1;
      const procLich = lich ? lich * ap : 0;                         // Lich: proc 1× por skill (não multiplica pelo nº de alvos)
      const total = direto * mult + (temAdaga ? giro * mult : 0) + procLich;
      const cdBase = k.rec ? k.rec(rr || 1) : null;
      // VORACIDADE POR ABATE (motor.js:1789): cada abate tira 1,5 s (5 s em chefe) de Q/W/E.
      // Sem isto o DPS da Katarina saia ate x1,63 abaixo do real a 25 abates/min (C3).
      const cd = cdBase != null ? cdVoraz(cdBase * (1 - cdr), h.t) : null;
      const dps = cd ? total / cd : 0, dpsDireto = cd ? (direto * mult) / cd : 0, dpsAdaga = cd && temAdaga ? (giro * mult) / cd : 0, dpsLich = cd ? procLich / cd : 0;
      out.push({ t: h.t, nome: h.name, rank: h.rank, rankUsado: rr, max: h.maxRank, naBarra: h.onBar, util: !direto && !temAdaga, adaga: temAdaga, auto: !!k.auto, dot: !!k.dot, alvo: k.alvo || null, dano: Math.round(dano), direto: Math.round(direto), giro: temAdaga ? giro : 0, total: Math.round(total), cdBase: cdBase != null ? +cdBase.toFixed(1) : null, cd: cd != null ? +cd.toFixed(1) : null, dps: Math.round(dps), dpsDireto: Math.round(dpsDireto), dpsAdaga: Math.round(dpsAdaga), dpsLich: Math.round(dpsLich), lichProc: Math.round(procLich) });
      if (temAdaga && cd) { giroDps += giro / cd; adagas.push(h.t); }
      lichDps += dpsLich;
    }
    out.push({ t: 'P', nome: 'Voracidade (giro)', dano: giro, dps: Math.round(giroDps), passiva: true, adagas, nota: adagas.length ? 'giro disparado por ' + adagas.join('/') : 'sem skill de adaga' });
    // CURA DO GIRO (motor.js:2169-2170): o giro devolve `curaBase + curaGiro[rank]` do dano que
    // causa — a cura PROPRA da Katarina que a extensao nao via (AGENTS.md, prova n.o 7).
    const _cg = curaGiroDe();
    const curaGiroS = _cg.tem ? _cg.cura * giroDps : 0;
    out.push({ t: 'L', nome: 'Perdição de Lich (proc)', dano: lich ? Math.round(lich * ap) : 0, dps: Math.round(lichDps), passiva: true, lich: true, nota: lich ? 'proc 1×/skill (' + Math.round(lich * 100) + '% AP)' : 'sem Lich equipado' });
    return { ap, ad, nivel: p.nivel, giro, cdr, efeitos: ef,
      // Cura do giro em numero: `cura` (fraccao) e `porSegundo` (cura/s contra o grupo).
      curaGiro: { cura: _cg.cura, porSegundo: +curaGiroS.toFixed(1), tem: _cg.tem },
      habs: out.sort((a, b) => (b.dps || 0) - (a.dps || 0)) };
  }


  // ------------------------------- VALOR DE UM PONTO DE HABILIDADE (ordem de unlock/subida)
  /** CONTEXTO de dano do campeão AGORA — lido UMA vez (player + tooltips dos equipados + a
   *  Voracidade do motor). É o que permite calcular o DPS de QUALQUER rank sem reler o DOM
   *  a cada pergunta (o `dpsPorHabilidade` lê o DOM e é caro). */
  function ctxDano() {
    const p = player();
    const ef = efeitosEquipados();
    const ap = p.poder || 0, ad = p.dano || 0;
    const adBase = (META.champAtual && META.champAtual.adBase) || (META.champ && META.champ.adBase) || 58;
    const g = _giro;
    const giro = Math.round(g.base + g.nivel * p.nivel + g.ap * ap + g.ad * Math.max(0, ad - adBase));   // Voracidade (passiva, motor)
    // `km` = abates/min medidos ao vivo: a Voracidade precisa da cadencia (motor.js:1789).
    return { p, ap, ad, cdr: ef.cdr, lich: ef.lich, giro, km: killsMinAoVivo(), magia: !!(META.champAtual && META.champAtual.magia) };
  }
  /** DPS de `t` NUM RANK `r` — MESMA fórmula de `dpsPorHabilidade` (base + ratio×escala +
   *  adaga×giro + proc do Lich, tudo sobre a recarga), parametrizada pelo rank.
   *  Rank 0 devolve 0: a habilidade não existe (motor.js:2837 recusa rank 0 na barra). */
  function dpsRank(ctx, t, r) {
    if (!(r > 0)) return 0;
    const k = KAT[t]; if (!k || k.passiva) return 0;
    const temAdaga = !!k.adaga;
    const escala = ctx.magia ? ctx.ap : ctx.ad;      // motor.js:923 `escalaPoder` (ver dpsPorHabilidade)
    const direto = (k.base ? k.base(r) : 0) + (typeof k.ratio === 'function' ? k.ratio(r) : (k.ratio || 0)) * escala + (k.adRatio || 0) * ctx.ad;
    const mult = k.mult || 1;
    const procLich = ctx.lich ? ctx.lich * ctx.ap : 0;
    const total = direto * mult + (temAdaga ? ctx.giro * mult : 0) + procLich;
    const cdBase = k.rec ? k.rec(r) : null;
    if (cdBase == null) return 0;
    // VORACIDADE POR ABATE (motor.js:1789) — mesma conta do `dpsPorHabilidade`.
    const cd = cdVoraz(cdBase * (1 - ctx.cdr), t, ctx.km);
    return cd > 0 ? total / cd : 0;
  }
  /** Números de BUFF lidos do TEXTO da habilidade (`data-dica`, que o jogo escreve a partir de
   *  `descricaoHab`, jogo.js:5833). É a MESMA técnica que `valorPassiva` já usa para os itens.
   *  PORQUE É PRECISO: o `serialKit` do inject.js (inject.js:107-123) só reencaminha um
   *  subconjunto dos campos do kit e `penSuspiro`/`duracaoPen`/`va` NÃO estão nessa lista —
   *  mas o jogo ESCREVE os números na descrição (ex.: R do Yasuo, motor.js:708: "por 15
   *  segundos, os golpes dele ignoram 30% da armadura"). */
  function buffDoTexto(dica) {
    const t = String(dica || '');
    const n = (re) => { const m = t.match(re); return m ? parseFloat(String(m[1]).replace(',', '.')) : 0; };
    return {
      penArmadura: n(/ignoram\s+([\d,]+)\s*%\s*da\s*armadura/i) / 100,
      penSeg: n(/por\s+([\d,]+)\s*segundos?[^.]{0,80}?ignoram/i),
      vaPct: n(/\+?\s*([\d,]+)\s*%\s*de\s*velocidade\s*de\s*ataque/i) / 100,
      vaSeg: n(/por\s+([\d,]+)\s*segundos?[^.]{0,80}?(?:mais\s+r[áa]pido|velocidade)/i),
    };
  }
  /** CONSTANTE DO MOTOR: a recarga da Tempestade de Aço do Yasuo é
   *  `max(minima, recarga / max(1, va / 0.697))` (motor.js:2056 `recargaQYasuo`). Logo +X de
   *  `va` acelera a Q em X/0,697. O 0,697 NÃO é meu — é o do motor. */
  const VA_BASE_MOTOR = 0.697;
  /** VALOR DE UM RANK que NÃO é dano directo (o "porquê" de subir uma utilitária). Cada termo
   *  tem derivação; quando não há número nenhum, devolve 0 (não se inventa valor):
   *   - penetração de armadura por N s  -> `pen × (N / recarga) × meuDps` (multiplica TODO o dano)
   *   - +velocidade de ataque por N s   -> `(va / 0,697) × (N / recarga) × meuDps` (motor.js:2056)
   *  Fonte dos números: campos do KIT quando existirem, senão o TEXTO da habilidade. */
  function valorBuff(ctx, t, r, dpsTotal, dica) {
    if (!(r > 0)) return 0;
    const k = KAT[t]; if (!k) return 0;
    const cdBase = k.rec ? k.rec(r) : null;
    if (cdBase == null) return 0;
    // RECARGA EFECTIVA (Voracidade, motor.js:1811): a frequencia com que o ponto sobe e a
    // real. Usava a recarga crua e o valor do buff ficava SUBESTIMADO (TK-02-148).
    const cd = cdVoraz(cdBase * (1 - ctx.cdr), t, ctx.km);
    if (!(cd > 0)) return 0;
    const txt = buffDoTexto(dica);
    const ser = (campo) => (typeof k[campo] === 'function' ? k[campo](r) : null);
    const pen = k.penSuspiro != null ? k.penSuspiro : txt.penArmadura;
    const penSeg = k.duracaoPen != null ? k.duracaoPen : txt.penSeg;
    const vaGanho = ser('va') != null ? ser('va') : txt.vaPct;
    const vaSeg = k.duracao != null ? k.duracao : txt.vaSeg;
    let v = 0;
    if (pen && penSeg) v += pen * (penSeg / cd) * (dpsTotal || 0);
    if (vaGanho && vaSeg) v += (vaGanho / VA_BASE_MOTOR) * (vaSeg / cd) * (dpsTotal || 0);
    // ---- PENETRACAO PASSIVA DO KIT (motor.js:529 -> 552; TK-02-114) --------------------------
    // A E do DARIUS da penetracao de armadura como PASSIVA (motor.js:573-574:
    // `Dá penetração de armadura (passiva)`): o motor aplica-a por rank em
    // `atributos`, SEM depender de recarga nem de duracao. Portanto o valor do ponto e
    // a diferenca de pen x TODO o dano — nao fracionado por (duracao/recarga) como o buff temporario.
    // Medido contra o Barao (armadura 144, sem itens de pen): rank 4 -> 0,29 de pen,
    // 1 - (1-0,29) = 0,71 da armadura que resta -> mit 0,5580 contra 0,4098 = +36,2% de dano.
    const penKitAgora = penKitDe(t, r);
    if (penKitAgora > 0) {
      const antes2 = r > 1 ? penKitDe(t, r - 1) : 0;
      const ganhoPen = penKitAgora - antes2;
      const alvoArm = (ctx && ctx.armadura != null) ? ctx.armadura : null;
      // o ganho relativo depende da armadura do alvo: d(mit)/d(pen) = arm/(100+arm*(1-pen))^2 * 100
      // sem armadura conhecida usa-se o valor do ponto x o dano total (limite conservador).
      if (alvoArm != null && alvoArm > 0) {
        const mitAntes = 100 / (100 + alvoArm * (1 - antes2));
        const mitDepois = 100 / (100 + alvoArm * (1 - penKitAgora));
        v += (mitDepois / mitAntes - 1) * (dpsTotal || 0);
      } else if (ganhoPen > 0) {
        v += ganhoPen * (dpsTotal || 0);
      }
    }
    return v;
  }
  /** VALOR DO PRÓXIMO PONTO em `t` (rank r -> r+1) — é ISTO que ordena o `subirHabilidades`.
   *  `r === 0` é um DESBLOQUEIO e ganha a habilidade INTEIRA (motor.js:2817: ao chegar a rank 1
   *  ela entra sozinha na barra) — leva `MULT_DESBLOQUEIO`, a frase do dono em número:
   *  "uma skill desbloqueada faz mais que UM PONTO em uma skill existente". */
  function valorDoPonto(ctx, t, r, dpsTotal, dica) {
    const ganhoDps = dpsRank(ctx, t, r + 1) - dpsRank(ctx, t, r);
    const ganhoBuff = valorBuff(ctx, t, r + 1, dpsTotal, dica) - valorBuff(ctx, t, r, dpsTotal, dica);
    let v = ganhoDps + ganhoBuff;
    if (!(r > 0)) v *= MULT_DESBLOQUEIO;
    return v;
  }

  /** Cura/s da melhor poção disponível (referência pro cálculo de sobrevivência). */
  function curaPocaoMax() {
    const p = readPotions();
    if ((p.vidaS || 0) > 0) return HEALVAL.vidaS;
    if ((p.vidaF || 0) > 0) return HEALVAL.vidaF;
    if ((p.vida || 0) > 0) return HEALVAL.vida;
    return 0;
  }

  const POTS = () => ['vida', 'vidaF', 'vidaS'].map((k) => ({ h: pocaoInfo(k).cura, c: pocaoInfo(k).preco, k }));
  /** Mix mais barato de ATÉ n poções (cooldown = EXAUSTAO) que cobre `alvo` de dano. */
  function melhorMix(n, alvo) {
    if (alvo <= 0) return { a: 0, b: 0, c: 0, h: 0, cost: 0 };
    const [p1, p2, p3] = POTS();
    let best = null;
    for (let a = 0; a <= n; a++) for (let b = 0; b <= n - a; b++) for (let c = 0; c <= n - a - b; c++) {
      const h = a * p1.h + b * p2.h + c * p3.h, cost = a * p1.c + b * p2.c + c * p3.c;
      if (h >= alvo && (!best || cost < best.cost)) best = { a, b, c, h, cost };
    }
    return best;
  }
  const mixLabel = (m) => m ? [m.a && m.a + '×P1', m.b && m.b + '×P2', m.c && m.c + '×P3'].filter(Boolean).join('+') || 'sem poção' : 'sem solução';

  // cache do golpe teórico da wiki (evita ler o DOM a cada poll)
  let _golpeWiki = { at: 0, key: '', v: 0 };

  // Mecânicas carregadas de TODOS os chefes. NOME, aviso (`carrega`) e espera vêm do MOTOR pelo
  // inject: `META.habChefe` = HAB_CHEFE (motor.js:3069-3079) e `META.rodizio` = RODIZIO_CHEFE
  // (motor.js:3080). O MULTIPLICADOR de dano está INLINE no `mecanicaChefe` (motor.js:3102-3109)
  // e NÃO é exportado — fica como fallback documentado, com o file:linha de cada golpe.
  //  investida/pancada/tentaculos = físico (armadura); olho/sopro/chuva/acido = mágico (RM)
  const MECANICA_FB = {
    investida:  { mult: 3.5, magico: false },   // motor.js:3102 `fis(3.5)`
    pancada:    { mult: 2.2, magico: false },   // motor.js:3103 `fis(2.2)`
    olho:       { mult: 2.6, magico: true  },   // motor.js:3104 `mag(2.6)`
    sopro:      { mult: 2.2, magico: true  },   // motor.js:3105 `mag(2.2)`
    chuva:      { mult: 1.8, magico: true  },   // motor.js:3106 `mag(1.8)`
    rugido:     { mult: 0,   magico: true  },   // motor.js:3107 — NAO e golpe: `as ×1,5` por 5 s
    acido:      { mult: 1.2, magico: true  },   // motor.js:3108 `mag(1.2)`
    tentaculos: { mult: 2.6, magico: false },   // motor.js:3109 `fis(2.6)`
    invocar:    { mult: 0,   magico: true  },   // motor.js:3117-3120 — NAO e golpe: invoca 2 larvas
  };
  /** A mecânica `mec` do motor: multiplicador de dano, se é mágica, o NOME (do HAB_CHEFE, que o
   *  motor manda) e os tempos. Sem o motor, cai nos valores acima — cada um com o seu file:linha. */
  function mecanicaDe(mec) {
    const fb = MECANICA_FB[mec] || null;
    const hc = META.habChefe && META.habChefe[mec];
    return {
      mult: fb ? fb.mult : 0,
      magico: fb ? fb.magico : ['olho', 'sopro', 'chuva', 'rugido', 'acido'].indexOf(mec) >= 0,
      nome: (hc && hc.nome) || mec,
      carrega: hc ? hc.carrega : null,      // motor.js:3069-3079 (aviso antes do golpe)
      espera: hc ? hc.espera : null,        // motor.js:3069-3079 (tempo entre mecanicas)
    };
  }
  /** Dano PREVISTO de uma mecânica carregada do chefe (o alvo é o `#hud-alvo`). */
  function danoMecanica(target, mec) {
    const m = mecanicaDe(mec);
    if (!m || !m.mult || !target || !target.name || !target.level) return 0;
    const p = player();
    const s = statsMonstro(target.name, target.level);
    if (!s || !p) return 0;
    const ND = META.nivelDif || { livre: 4, danoMonstro: 0.15, maxDanoMonstro: 3 };
    const dif = Math.max(0, target.level - (p.nivel || 1) - ND.livre);
    const fM = dif ? Math.min(ND.maxDanoMonstro || 3, 1 + ND.danoMonstro * dif) : 1;
    const def = m.magico ? (p.rm || 0) : (p.armadura || 0);
    return s.ad * m.mult * fM * (100 / (100 + def));
  }

  /** Decisão SMART: mantém o HP acima do GOLPE IMINENTE real, com piso de segurança.
   *  - "golpe iminente" = o ÚLTIMO golpe que ACABOU de acontecer (não média, não mediana,
   *    não pior): é o dano que o boss acabou de causar.
   *  - conta a CURA DAS SKILLS (sem poção) durante o intervalo até o próximo golpe.
   *  - piso = % do HP máx, pra aguentar o golpe CARREGADO (que é maior que o normal) —
   *    sem esse piso o boneco morre no burst (a regra "só o último golpe" morre feio).
   *  Devolve { k, reason } ou null. */
  function decidirPocao() {
    const pot = readPotions();
    const live = (typeof window !== 'undefined' && window.__lolidleLive) || null;
    const hp = live?.hp?.cur;
    let max = live?.hp?.max;
    if (hp == null || !max) return null;                            // sem HP medido → a emergência cuida
    // "max" é o do PERSONAGEM EQUIPADO. Se a leitura divergir do estado, usa o MENOR (mais seguro):
    // itens diferentes dão HP máx diferente — nunca usar um max maior do que o real do build atual.
    try { const mv = player().vida; if (mv && mv > 0) max = Math.min(max, mv); } catch { /* ignore */ }
    const rates = live.rates || {};
    const healSkill = Math.max(0, rates.healSkillRate != null ? rates.healSkillRate : (rates.healRate || 0));

    // último golpe REAL: a última queda de HP registrada no contexto atual (chefe ou mobs)
    const log = (live.boss ? live.hitLog?.boss : live.hitLog?.mob) || [];
    const ult = log.length ? log[log.length - 1] : null;
    const ultGolpe = ult && ult.drop ? ult.drop : 0;
    const asMult = live.furia ? 1.5 : 1;    // Rugido ("furioso"): o chefe bate 1,5× mais rápido por 5 s
    const gapS = Math.min(Math.max((ult && ult.gapMs) || 1000, 250), 3000) / 1000 / asMult;

    const pisoPct = (() => { const p = live.boss ? numOr(cfg.pocaoPisoChefe, 0.9) : numOr(cfg.pocaoPisoPct, 0.75); return live.furia ? Math.min(0.97, p + 0.05) : p; })();
    const margem = numOr(cfg.pocaoMargem, 1.1);
    // golpe iminente TEÓRICO da WIKI pro alvo atual (ad × fator de nível × mitigação).
    // A wiki já sabe o dano por golpe ANTES de ele acontecer — usa isso em vez de só reagir.
    let golpeWiki = 0;
    try {
      const tg = live.target;
      if (tg && tg.name && tg.level && META.monstros && META.monstros[tg.name]) {
        const key = tg.name + '@' + tg.level;
        if (_golpeWiki.key !== key || Date.now() - _golpeWiki.at > 3000) {
          // CURA DO GIRO (motor.js:2188-2193) entra tambem: o golpe que a pocao tem de cobrir
          // e menor quando a Katarina esta a girar (TK-02-130).
          const av = avaliar(tg.name, tg.level, player(), { skill: healSkill, pocao: 0, giro: curaGiroS() }, meuDps() || 0);
          _golpeWiki = { at: Date.now(), key, v: av && Number.isFinite(av.danoGolpe) ? av.danoGolpe : 0 };
        }
        golpeWiki = _golpeWiki.v;
      }
    } catch { /* ignore */ }
    // golpe FORTE previsto: mecânica carregada do chefe (o aviso chega ~1 s antes)
    let golpeCarga = 0, mecNome = null, fatal = false;
    const carga = live.carga;
    const mcCarga = mecanicaDe(carga && carga.mec);
    if (carga && mcCarga && mcCarga.mult > 0) {
      golpeCarga = danoMecanica(live.target, carga.mec);
      mecNome = mcCarga.nome;
      fatal = golpeCarga >= max;
    }
    const iminente = Math.max(ultGolpe, golpeWiki, golpeCarga * margem);   // margem só na PREVISÃO da carga
    const sequencia = golpeCarga > 0 ? golpeCarga + ultGolpe : 0;          // CARGA + o golpe SEGUINTE (não morrer no encadeado)
    const piso = max * pisoPct;
    const alvo = Math.min(max, Math.max(piso, iminente, sequencia));
    const proj = Math.min(max, hp + healSkill * gapS);             // HP previsto no próximo golpe sem poção
    const tagCarga = mecNome ? `, CARGA ${mecNome} ~${Math.round(golpeCarga)}${fatal ? ' (FATAL)' : ''}` : '';
    const tagFuria = live.furia ? ', FÚRIA (rugido AS ×1,5)' : '';
    const base = `smart: últ.golpe ${Math.round(ultGolpe)} (wiki ${Math.round(golpeWiki)})${tagCarga}${tagFuria}, HP ${Math.round(hp)}→${Math.round(proj)} (cura ${Math.round(healSkill)}/s), alvo ${Math.round(alvo)} (piso ${Math.round(piso)})`;
    // NÃO DÁ PRA CURAR: o maior golpe (ou a sequência CARGA+seguinte) mata daqui e a poção
    // mais forte DISPONÍVEL não cobre o buraco → marca `live.fatal` e a automação FUGE (B).
    {
      const bestK = ['vidaS', 'vidaF', 'vida'].find((x) => pot[x] > 0) || null;
      const bestHeal = bestK ? HEALVAL[bestK] : 0;
      // ESCUDO ACTIVO (motor.js:2718 `d.escudo -= abs; dano -= abs`; o HUD escreve-o como
      // `(+N)` em jogo.js:6203): entra na piscina que a poção tem de cobrir. Sem ele a poção
      // era bebida com escudo cheio e o golpe que mata passava a nao matar — e ao contrario.
      const escudo = (player() || {}).escudo || 0;
      const golpeMax = Math.max(iminente, sequencia, ultGolpe);
      if (golpeMax >= hp + escudo + bestHeal) {
        live.fatal = true;
        live.fatalMotivo = `${base} — golpe ${Math.round(golpeMax)} ≥ HP ${Math.round(hp)} + ${bestK || 'nada'} (${bestHeal}): injogável, SAIR (B)`;
        return { k: bestK, fatal: true, flee: true, reason: live.fatalMotivo };
      }
      live.fatal = false;
    }
    if (fatal) {
      const forte = ['vidaS', 'vidaF', 'vida'].find((x) => pot[x] > 0) || null;
      return { k: forte, fatal: true, reason: `${base} — CARGA FATAL (${Math.round(golpeCarga)} ≥ HP máx ${Math.round(max)}): nenhuma poção salva; usar a mais forte${forte ? ' → ' + forte : ''} e sair (B)` };
    }
    // PISO É PISO: se o HP está abaixo do piso, NÃO deixa a cura de skill (que é medida de forma
    // ruidosa no canvas) "cancelar" a poção. Isto é o que faltava e deixou o char entrar na
    // CARGA do Dragão a 57% e morrer.
    const faltaProj = alvo - proj;
    const falta = hp < piso ? Math.max(faltaProj, alvo - hp) : faltaProj;
    if (falta <= 0) return { k: null, reason: `${base} — seguro, sem poção` };
    // JANELA: usa UMA poção que cubra o buraco (o sim provou que "picar" com 2×P1 é
    // mais arriscado — a 2ª chega 1 s depois e o chefe bate no meio). nSlots=1.
    const nSlots = 1;
    const mix = melhorMix(nSlots, falta);
    // prefere a poção mais BARATA que faz parte do mix ideal (o resto sai nos próximos polls)
    let k = null;
    if (mix) for (const [x, cx] of [['vida', 'a'], ['vidaF', 'b'], ['vidaS', 'c']]) { if (mix[cx] > 0 && pot[x] > 0) { k = x; break; } }
    if (!k) { const escolha = falta <= HEALVAL.vida ? 'vida' : falta <= HEALVAL.vidaF ? 'vidaF' : 'vidaS'; k = (pot[escolha] > 0) ? escolha : ['vidaS', 'vidaF', 'vida'].find((x) => pot[x] > 0); }
    if (!k) return { k: null, reason: `${base} — falta ${Math.round(falta)}, sem poção disponível` };
    const mixTxt = mix ? mixLabel(mix) : null;
    return { k, falta: Math.round(falta), ultGolpe, alvo: Math.round(alvo), healSkill: Math.round(healSkill), hpPct: Math.round((hp / max) * 100), nSlots, mixTxt, reason: `${base} → ${k} (+${Math.round(falta)}${mixTxt ? `, mix ${mixTxt}` : ''})` };
  }

  /** Sobrevivência PADRÃO = (cura efetiva das skills + cura efetiva das poções) vs DPS.
   *
   *  `dps` (5.o argumento, opcional) = DPS de SAIDA do jogador contra este monstro. Com ele entram
   *  as duas curas que faltavam e que o motor aplica:
   *    · ROUBO DE VIDA — motor.js:1226-1228 `cura = dano × a.rouboVida` (so no AUTO-ATAQUE);
   *      vale ~269 cura/s numa base AD (AGENTS.md, prova n.o 5) e decidia a luta do Chefe.
   *    · CURA DO GIRO — motor.js:2169-2170 (Katarina).
   *  Sem `dps` as duas ficam a 0 (nao se inventa cura sem saber o dano que a produz). */
  function avaliar(monstro, nivel, player, cura, dps) {
    const s = statsMonstro(monstro, nivel);
    if (!s || !player) return null;
    const dif = Math.max(0, nivel - (player.nivel || 1) - (META.nivelDif?.livre ?? 4));
    const ND = META.nivelDif || { danoMonstro: 0.15, maxDanoMonstro: 3, danoJogador: 0.07, minDanoJogador: 0.25 };
    const fM = dif ? Math.min(ND.maxDanoMonstro || 3, 1 + ND.danoMonstro * dif) : 1;
    const fJ = dif ? Math.max(ND.minDanoJogador ?? 0.25, 1 - ND.danoJogador * dif) : 1;
    const def = s.magico ? (player.rm || 0) : (player.armadura || 0);
    const mit = 100 / (100 + def);
    const as = s.as || 1;
    const intervalo = 1 / as;                      // janela entre golpes
    const nPocoes = Math.max(1, Math.floor(intervalo / EXAUSTAO())); // cooldown do jogo (motor)
    // motor.js:898 — o PAPEL do campeão: `recebido` escala o dano que ELE leva (Katarina 0,75;
    // tanques 0,75; testado com 1 e com 0,5 pelo banco). Vem do META (jogo), nunca copiado.
    const _cid = (META.champAtual && META.champAtual.id) || null;
    const _papel = (_cid && META.kits && META.kits[_cid] && META.kits[_cid].papel) || (META.champAtual && META.champAtual.papel) || META.papel || {};
    const _recebido = Number.isFinite(_papel.recebido) ? _papel.recebido : 1;
    const dpsTomado = s.ad * fM * as * mit * _recebido;
    const danoGolpe = s.ad * fM * mit * _recebido;   // A6: o papel entra TAMBEM no golpe iminente             // dano iminente por golpe
    // pior MECÂNICA carregada do chefe (rodízio do motor): pode ser insta-kill
    let piorMec = 0, mecFatalNome = null;
    const rod = META.rodizio && META.rodizio[monstro];
    if (rod) for (const mc of rod) {
      const mm = mecanicaDe(mc); if (!mm || !mm.mult) continue;
      const d = s.ad * mm.mult * fM * (100 / (100 + (mm.magico ? (player.rm || 0) : (player.armadura || 0))));
      if (d > piorMec) { piorMec = d; mecFatalNome = mm.nome; }
    }
    // PISCINA DE VIDA = vida maxima + ESCUDO activo (motor.js:2718; `(+N)` em jogo.js:6203).
    // `vidaEff` e o que o jogador AGUENTA, nao so a vida — um Yasuo com o Fluxo cheio sobrevive
    // a um golpe que o modelo diz que mata (docs/auditoria-do-jogo.md C6).
    const vidaPool = (player.vidaEff != null ? player.vidaEff : player.vida) || 0;
    const mortal = piorMec > 0 && piorMec >= vidaPool;
    const curaSkill = Math.max(0, cura?.skill || 0);            // cura/s medida das skills (sem poção)
    const curaPocao = cura?.pocao || 0;            // cura/s EFETIVA medida das poções
    // ROUBO DE VIDA (motor.js:1226-1228): cura = dano × rv, e o dano e o DEPOIS de mitigar
    // (o `golpear` aplica `mitigar` e so depois multiplica pelo rv). Logo cura/s = rv × dps × mit.
    // CURA DO GIRO (motor.js:2169-2170) entra por `cura.giro` quando o chamador a conhece.
    const curaRv = dps > 0 ? (player.rv || 0) * dps * mitSaida(s, magiaChamp()) : 0;
    const curaGiroS = Math.max(0, cura?.giro || 0);
    const curaTotal = curaSkill + curaPocao + curaRv + curaGiroS;
    const liquido = dpsTomado - curaTotal;
    const alvoGolpe = Math.max(0, danoGolpe - curaSkill * intervalo); // o que a poção precisa cobrir por janela
    const mix = melhorMix(nPocoes, alvoGolpe);
    const tMorrer = liquido > 0 ? (vidaPool || 1) / liquido : Infinity;
    return { monstro, nivel, dif, fM, fJ, fPapel: (typeof _recebido === 'number' ? _recebido : 1), hp: s.hp, as, intervalo, nPocoes, dpsTomado, danoGolpe, piorMec, mecFatalNome, mortal, hpSeguro: Math.max(danoGolpe, piorMec), curaSkill, curaPocao, curaRv, curaGiroS, curaTotal, liquido, alvoGolpe, mix, mixTxt: mixLabel(mix), custoPocaoS: mix ? mix.cost / intervalo : null, tMorrer, morre: liquido > 0 || !mix || mortal, chefe: s.chefe, magico: s.magico };
  }

  /** Agrega os ciclos observados por região (médias por minuto + mortes).
   *
   *  GUARDA DE RE-ENTRÂNCIA (2026-10-18) — sem isto o JOGO CONGELA. Existe um CICLO REAL:
   *    agregar -> curaGiroS -> dpsPorHabilidade -> cdVoraz -> killsMinAoVivo -> ritmoMobs -> agregar
   *  Provado ao vivo, no browser do dono, com `Debugger.pause`: a stack tinha centenas de frames
   *  deste ciclo repetidos, o main thread nunca mais respondeu e a página morreu (CPU baixa — a
   *  pilha rebentava em `RangeError`, os `try/catch` do caminho engoliam-no, e a recursão
   *  recomeçava de cada vez). Quem re-entra recebe o ÚLTIMO resultado (ou `[]`, no primeiro
   *  cálculo) e NUNCA recomputa. Preferir isto a `try/catch`: engolir o estouro da pilha é o que
   *  transformava a recursão num bloqueio eterno em vez de um erro visível. */
  let _agregarEmCurso = false;
  let _agregarUltimo = [];
  let _agregarReentradas = 0;
  function agregar() {
    if (_agregarEmCurso) { _agregarReentradas++; return _agregarUltimo; }
    _agregarEmCurso = true;
    try { _agregarUltimo = _agregarCorpo(); return _agregarUltimo; }
    finally { _agregarEmCurso = false; }
  }
  function _agregarCorpo() {
    const por = {};
    for (const c of farm.cycles || []) {
      const r = (por[c.region] = por[c.region] || { region: c.region, n: 0, janelas: [], g: 0, x: 0, p: 0, gp: 0, hs: 0, hp: 0, k: 0, hpm: null, chs: 0, chn: 0, chp: 0, chpn: 0, m: 0, deaths: 0, boss: null, bossMs: 0, bossN: 0, bpoc: 0, bpc: 0 });
      r.n++;
      // D (TK-01-42): guardar as JANELAS (run ids) — duas medidas de janelas diferentes nao sao comparaveis.
      if (c.janela != null && !r.janelas.includes(c.janela)) r.janelas.push(c.janela);
      const mm = c.mobFase?.perMin;
      if (mm) { r.g += mm.gold; r.x += mm.xp; r.p += mm.potions; r.gp += mm.goldPotion || 0; r.hs += mm.healSkill || 0; r.hp += mm.healPotion || 0; r.k += mm.kills || 0; r.m++; }
      const mf = c.mobFase;
      if (mf && mf.hpMin != null && mf.hpMax) { const rel = mf.hpMin / mf.hpMax; r.hpm = r.hpm == null ? rel : Math.min(r.hpm, rel); }
      // cura medida NA FASE DO CHEFE (contexto 'chefe') — pra sobrevivência real
      const bf = c.bossFase;
      if (bf && bf.durMs > 3000) {
        const hsB = bf.ctxS?.chefe?.healS;
        if (hsB != null) { r.chs += hsB; r.chn++; }
        r.chp += (bf.healPotion || 0) / (bf.durMs / 60000) / 60; r.chpn++;
        if ((bf.potions || 0) > 0) { r.bpoc += bf.potions; r.bpc++; }
      }
      r.deaths += c.deaths || 0;
      if (c.boss) r.boss = c.boss;
      if (c.bossDurMs) { r.bossMs += c.bossDurMs; r.bossN++; }
    }
    const pl = player();
    const cp = curaPocaoMax();
    // `curaGiroS()` NÃO depende da região: calcular UMA vez, fora do `.map`. Lá dentro era uma
    // chamada por região — e é exactamente ela que entra no ciclo de recursão da guarda acima.
    const _giroS = curaGiroS();
    const arr = Object.values(por).map((r) => {
      const d = r.m || 1;
      const rm = (r.region || '').match(/(\d+)\s*[–-]\s*(\d+)/);
      // NIVEL DO CHEFE pela regra do motor (motor.js:1121): o texto da regiao da a faixa (n0, n1)
      // e o jogador e o actual. Antes era `rm[1] + 2` (o topo da faixa) — media o risco do chefe
      // contra um chefe 4-6 niveis acima do real.
      const nivelChefe = rm ? nivelChefeDe({ nm: [+rm[1], +rm[2]] }, (player() || {}).nivel) : null;
      const curaSkill = (r.hs / d) / 60; // cura/s das skills nos mobs (medido)
      const curaSkillChefe = r.chn ? r.chs / r.chn : curaSkill; // cura/s das skills NO CHEFE
      let curaPocao = (r.hp / d) / 60;    // cura/s EFETIVA das poções (mobs)
      const curaPocaoChefe = r.chpn ? r.chp / r.chpn : curaPocao;
      if (!curaPocaoChefe) curaPocao = cp * 0.6; // região nova: estimativa conservadora
      // CURA DO GIRO (motor.js:2188-2193): a Katarina cura sozinha enquanto gira. O `risco` e
      // o numero que decide se a regiao e segura (e quantas pocoes gasta) — tinha de a levar.
      // `_giroS` vem de FORA do map (não depende da região): ver o topo de `_agregarCorpo`.
      const risco = r.boss && nivelChefe ? avaliar(r.boss, nivelChefe, pl, { skill: curaSkillChefe, pocao: curaPocaoChefe || cp * 0.6, giro: _giroS }) : null;
      return { region: r.region, n: r.n, janelas: r.janelas, deaths: r.deaths, boss: r.boss, goldMin: r.g / d, xpMin: r.x / d, killsMin: r.k / d, mobHpMinRel: r.hpm, potMin: r.p / d, goldPotionMin: r.gp / d, healSkillS: curaSkill, healSkillChefeS: curaSkillChefe, healPotionS: curaPocao, bossMs: r.bossN ? r.bossMs / r.bossN : null, potChefe: r.bpc ? r.bpoc / r.bpc : null, risco: risco ? { nivel: nivelChefe, hp: risco.hp, dps: risco.dpsTomado, danoGolpe: risco.danoGolpe, intervalo: risco.intervalo, nPocoes: risco.nPocoes, curaSkill: risco.curaSkill, curaPocao: risco.curaPocao, curaTotal: risco.curaTotal, liquido: risco.liquido, mixTxt: risco.mixTxt, custoPocaoS: risco.custoPocaoS, tMorrer: risco.tMorrer, fM: risco.fM, piorMec: risco.piorMec, mecFatalNome: risco.mecFatalNome, mortal: risco.mortal, morre: risco.morre } : null };
    });
    arr.sort((a, b) => b.goldMin - a.goldMin);
    return arr;
  }

  /** Recomenda a melhor região: maior ouro/min LÍQUIDO entre as sobrevivíveis. */
  function recomendar() {
    const agg = agregar();
    const viaveis = agg.filter((r) => r.risco && !r.risco.morre);
    const pool = viaveis.length ? viaveis : agg;
    const liq = (r) => (r.goldMin || 0) - (r.goldPotionMin || 0);
    const m = pool.slice().sort((a, b) => liq(b) - liq(a))[0] || null;
    if (!m) return null;
    return { regiao: m.region, ouroLiquidoMin: liq(m), xpMin: m.xpMin || 0, chefe: m.boss, sobrevive: !!(m.risco && !m.risco.morre), mix: m.risco?.mixTxt || null, sinalUlt: valeUlt(), ritmo: ritmoMobs() };
  }

  /** Rankeia itens pelo ganho EFETIVO de DPS vs um alvo (passivas incluídas). */
  function rankItens(alvo) {
    const p = player();
    const poder = p.poder || 0;
    const armAlvo = alvo?.armadura || 0;
    // O `rankItens` pontua AP × penetração MÁGICA contra o ALVO -> a armadura efectiva leva o
    // RM_MONSTRO do motor (motor.js:1202). Sem ele o ganho de DPS mágico saía subestimado.
    const mit = (pen) => 100 / (100 + armMagicaEfetiva(armAlvo, pen));
    const cdrAtual = Math.min(CAP_CDR, (efeitosEquipados().cdr || 0));
    // CDR SÓ NAS HABILIDADES (a MESMA correcção do `scoreSet`): o dano de auto-ataque não escala
    // com a recarga. A fracção vem do `dpsPorHabilidade` (repartição já existente no ficheiro).
    let fracHabs = 0;
    try {
      const lista = (dpsPorHabilidade().habs || []);
      const dh = lista.filter((h) => !h.auto && !h.passiva).reduce((s, h) => s + (h.dps || 0), 0);
      const da = lista.filter((h) => h.auto || h.passiva).reduce((s, h) => s + (h.dps || 0), 0);
      if (dh + da > 0) fracHabs = dh / (dh + da);
    } catch { /* sem arsenal */ }
    const fatorCdr = (c) => fracHabs / (1 - c) + (1 - fracHabs);
    const dpsAtual = poder * mit(efeitosEquipados().penMag || 0) * fatorCdr(cdrAtual);
    return (META.itens || []).map((it) => {
      const ap = it.ap || 0, pen = it.penMag || 0;
      let apPct = it.apPct || 0; if (!apPct && it.efeito) { const m = it.efeito.match(/Poder de Habilidade total em (\d+)%/i) || it.efeito.match(/\+(\d+)% do Poder/i); if (m) apPct = +m[1] / 100; }
      let cdr = it.cdr || 0; if (!cdr && it.efeito) { const m = it.efeito.match(/[\u2212-]\s*(\d+)\s*%\s*(?:na\s*)?recarga/i); if (m) cdr = +m[1] / 100; }   // inclui a passiva
      const poderNovo = (poder + ap) * (1 + apPct);
      const cdrNovo = Math.min(CAP_CDR, cdrAtual + cdr);
      const dpsNovo = poderNovo * mit(pen) * fatorCdr(cdrNovo);
      const ganho = dpsAtual > 0 ? dpsNovo / dpsAtual - 1 : 0;
      return { id: it.id, nome: it.nome, raridade: it.raridade, espaco: it.espaco, ap, penMag: pen, apPct, cdr, efeito: it.efeito || null, ganho };
    }).sort((a, b) => b.ganho - a.ganho);
  }

  /** Planner: pra cada item-alvo, onde farmar, mobs/chefe e eficiência (drops/h). */
  function planejar(ids) {
    const p = player();
    const agg = agregar();
    const cp = curaPocaoMax();
    const out = [];
    for (const id of (ids || [])) {
      const o = META.ondeItem?.[id];
      if (!o) continue;
      const it = (META.itens || []).find((x) => x.id === id);
      for (const zid of Object.keys(o)) {
        const z = o[zid]; const zona = z.zona || {};
        const mobs = (zona.monstros || []).map((m) => m[0]);
        const bossNome = zona.chefe ? zona.chefe[0] : null;
        const nivel = zona.nm ? Math.round((zona.nm[0] + zona.nm[1]) / 2) : (zona.faixa ? Math.round((zona.faixa[0] + zona.faixa[1]) / 2) : null);
        const reg = agg.find((r) => zona.nome && r.region.startsWith(zona.nome));
        // CURA DO GIRO (motor.js:2188-2193) — ver `curaGiroS`: entra no mob e no chefe.
        const _giroS = curaGiroS();
        const curaMob = reg ? { skill: reg.healSkillS || 0, pocao: reg.healPotionS || cp * 0.6, giro: _giroS } : { skill: 0, pocao: cp * 0.6, giro: _giroS };
        const curaChefe = reg ? { skill: reg.healSkillChefeS || 0, pocao: reg.healPotionS || cp * 0.6, giro: _giroS } : curaMob;
        const avMob = mobs[0] ? avaliar(mobs[0], nivel, p, curaMob) : null;
        const avChefe = bossNome ? avaliar(bossNome, nivel + 2, p, curaChefe) : null;
        // A TABELA DE DROP DEPENDE DA CLASSE (motor.js:383 DROPS vs 397 DROPS_AP; 407 carrega as duas).
        // MEDIDO: o Barao tem o 3031 Gume do Infinito em DROPS e o 3089 Rabadon em DROPS_AP. Antes isto
        // preferia SEMPRE `.ap`, logo respondia a tabela errada a um campeao AD.
        const minhaClasse = (META.champAtual && META.champAtual.magia) ? 'ap' : 'ad';
        const chance = z.porClasse ? (z.porClasse[minhaClasse] || 0) : 0;
        const killsH = reg ? (reg.killsMin || 0) * 60 : null;
        const dropsH = killsH && chance ? killsH * chance : null;
        const sobreviveMobObs = reg && reg.mobHpMinRel != null ? reg.mobHpMinRel > (cfg.mobHpMinRel || 0.15) : null;
        out.push({ item: id, nome: it ? it.nome : id, zona: zid, zonaNome: zona.nome, faixa: zona.faixa, mobs, chefe: bossNome, chance, sobreviveMob: sobreviveMobObs != null ? sobreviveMobObs : (avMob ? !avMob.morre : null), sobreviveMobObs, chefeFatal: avChefe ? avChefe.morre : null, dropsH });
      }
    }
    return out.sort((a, b) => (b.dropsH || 0) - (a.dropsH || 0));
  }

  /** Onde cada item dropa (do ONDE_ITEM). */
  function ondeItem(id) {
    const o = META.ondeItem?.[id];
    if (!o) return null;
    return Object.keys(o);
  }
  function exportar() {
    return { at: Date.now(), farm: { cycles: farm.cycles, log: farm.log, issues: farm.issues }, meta: { at: META.at, monstros: META.monstros, locais: META.locais, balanco: META.balanco }, agregado: agregar(), recomendacao: recomendar() };
  }
  function importar(d) {
    if (!d || !d.farm) return false;
    farm.cycles = d.farm.cycles || []; farm.log = d.farm.log || []; farm.issues = d.farm.issues || [];
    publishFarm();
    try { chrome.storage.local.set({ [AGG_KEY]: agregar() }); } catch { /* ignore */ }
    return true;
  }

  // ------------------------------------------------------------- acumulador por run
  let lastAcc = 0, lastPot = {};
  function accumulate() {
    const now = Date.now();
    const dt = lastAcc ? (now - lastAcc) / 1000 : 0;
    lastAcc = now;
    if (dt <= 0 || dt > 10) return;
    let st = {};
    try { st = JSON.parse(document.documentElement.dataset.lolidleAuto || '{}'); } catch { /* ignore */ }
    const pot = readPotions();
    if (farm.current) {
      const c = farm.current;
      const fase = c.fase === 'boss' ? (c.bossFase || (c.bossFase = novaFase(now))) : (c.mobFase || (c.mobFase = novaFase(c.startedAt || now)));
      fase.dmg = (fase.dmg || 0) + (st.mydps || 0) * dt;
      fase.heal = (fase.heal || 0) + (st.heal || 0) * dt;
      // cura/dano POR CONTEXTO (wave de mobs / furioso / chefe)
      const ctx = contexto(now, st.boss);
      fase.ctx = fase.ctx || {};
      const cx = fase.ctx[ctx] = fase.ctx[ctx] || { t: 0, heal: 0, dmg: 0 };
      cx.t += dt; cx.heal += (st.heal || 0) * dt; cx.dmg += (st.mydps || 0) * dt;
      if (st.hp != null) { fase.hpMin = fase.hpMin == null ? st.hp : Math.min(fase.hpMin, st.hp); fase.hpMax = fase.hpMax == null ? st.hp : Math.max(fase.hpMax, st.hp); fase.hpSum = (fase.hpSum || 0) + st.hp; fase.hpN = (fase.hpN || 0) + 1; }
      c.dmgRate = st.mydps || 0; c.healRate = st.heal || 0;
      for (const k of ['vida', 'vidaF', 'vidaS']) {
        const antes = lastPot[k], agora = pot[k];
        if (Number.isFinite(antes) && Number.isFinite(agora) && agora < antes) {
          const n = antes - agora;
          fase.potions = (fase.potions || 0) + n;
          fase.potUsed[k] = (fase.potUsed[k] || 0) + n;
          if (cx) cx.potion = (cx.potion || 0) + n * HEALVAL[k];
        }
      }
      c.healSkill = fase.heal - (fase.potUsed.vida * HEALVAL.vida + fase.potUsed.vidaF * HEALVAL.vidaF + fase.potUsed.vidaS * HEALVAL.vidaS);
      publishFarm();
    }
    lastPot = pot;
  }

  /** Id do local (mapa) a partir do texto da região. */
  /** Normaliza acento E caixa dos dois lados (o HUD escreve "Covil do Barão nível 40–50" e o
   *  id é "barao"; "Fonte (núcleo)" tem de casar com "Fonte"). Sem isto a fuga/viagem não achavam o local. */
  function localId(regionTxt) {
    const t = semAcento(String(regionTxt == null ? '' : regionTxt)).toLowerCase().trim();
    if (!t) return null;
    const l = (META.locais || []).find((x) => {
      const n = semAcento(String(x.nome || '')).toLowerCase().trim();
      const id = semAcento(String(x.id || '')).toLowerCase().trim();
      return (n && t.startsWith(n)) || (id && t.startsWith(id));
    });
    return l ? l.id : null;
  }

  // ------------------------------------------------------------- morte-zero
  let fugindoAte = 0;
  /** FUGA — SOBREVIVÊNCIA, não auto-play (correcção do Lead, 2026-10-14).
   *  REGRA DO DONO (verbatim): "e e pra fugir de qualquer coisa que mata, pra qualquer boneco, em
   *  qualquer situacao." e "ARRUMA ESSA PORRA de fugir de chefe que mata, por que NAO E PRA MORRER,
   *  NUNCA, COM ESSE SCRIPT."
   *  DEFEITO MEDIDO: o portão era `cfg.enabled` (ramo do AUTO-PLAY, que tem excepção de campeão) e
   *  a função saía cedo sem CHEFE — logo na Katarina (`enabled=false`) ela não fugia e morria, e
   *  morrer para um MOB nunca contava. Agora pende da MANUTENÇÃO pelo interruptor próprio `fugir`
   *  e foge de QUALQUER coisa que mata (golpe injogável, região que mata, luta perdida sem poções).
   *  O cooldown `cfg.fugirMs` mantém-se para não haver ping-pong.
   *
   *  NÍVEL DO CHEFE (contexto, para não inventar): o motor faz
   *  `Math.max(n0+2, Math.min(n1+2, nivelJogador))` (motor.js:1121). O dono falou de uma actualização
   *  do jogo que limita o chefe a 4 níveis acima do jogador, mas essa regra NÃO está em
   *  docs/game-src/ — fica a FÓRMULA DO CÓDIGO e a dúvida registada (nada inventado). */
  function checarChefeFatal() {
    if (pausado) return;
    if (!podeFazer('fugir').pode) return;                     // hierarquia: fugir -> manutencao (+ cfg.fugir)
    if (Date.now() < fugindoAte) return;                      // cooldown: não repete a fuga sem parar
    const live = (typeof window !== 'undefined' && window.__lolidleLive) || null;
    const fatalVivo = !!(live && live.fatal);                 // o smart da poção: o golpe passa da cura possível
    const c = farm.current;
    const regiaoTxt = (c && c.region) ? c.region : (readLocation().text || '');
    const idReg = localId(regiaoTxt);
    const r = (c && c.region) ? agregar().find((x) => x.region === c.region) : null;
    // `morre`: risco MEDIDO na região OU o veredicto FAIL-CLOSED do `estimarRegiao` (região acima do
    // nível é declarada mortal sem precisar de histórico). Sem o segundo, no stub não havia medida e a fuga não disparava.
    const morre = !!(r && r.risco && r.risco.morre) || !!(idReg && (() => { try { return (estimarRegiao(idReg) || {}).morte; } catch { return false; } })());
    let est = null; try { est = idReg ? estimarLuta(idReg) : null; } catch { /* ignore */ }
    const perde = !!(est && est.ganha === false);             // a estimativa diz que a luta está perdida
    // AS POÇÕES COBREM A LUTA? REGRA DO DONO, MANTIDA: "se as poções cobrem a luta estimada, NÃO
    // foge — TERMINA o chefe". A fuga é para o que MATA, não para o que assusta.
    let cobrem = false;
    if (!fatalVivo && est && est.ganha && est.potTotal != null) {
      try {
        const p = readPotions();
        const temos = (p.vida || 0) * HEALVAL.vida + (p.vidaF || 0) * HEALVAL.vidaF + (p.vidaS || 0) * HEALVAL.vidaS;
        const precisa = est.potTotal * Math.max(1, curaPocaoMax());
        cobrem = temos >= precisa;
      } catch { /* ignore */ }
    }
    // QUEM MANDA FUGIR: golpe injogável OU região que mata OU luta perdida sem poções que cheguem.
    const foge = fatalVivo || morre || (perde && !cobrem);
    if (!foge) return;
    if (!fatalVivo && cobrem) { logEvent('chefe-fatal', { adiado: 'poções cobrem', regiao: regiaoTxt, perde, morre }); return; }
    fugindoAte = Date.now() + (cfg.fugirMs || 30000);
    const decisao = { regiaoMata: morre, lutaPerdida: perde, regiao: regiaoTxt, regiaoId: idReg, chefe: (c && c.boss) || null, fatalVivo, morre, perde, cobrem,
      dps: r && r.risco ? Math.round(r.risco.dps) : null, tMorrer: r && r.risco ? r.risco.tMorrer : null, acao: 'fugir (B → base)' };
    logEvent('chefe-fatal', decisao);
    if (live) live.fatal = false;
    press('b'); // volta pra base
    // VOLTAR À REGIÃO? Só quando a fuga NÃO foi por derrota prevista nem por golpe injogável —
    // `risco.morre` é uma probabilidade medida (a região pode ter mudado), mas "perde a luta" e
    // "golpe que mata" são determinísticos: voltar era o ciclo morte→fuga→morte que o dono proibiu.
    if (idReg && !fatalVivo && !perde && !_viagemAgendada) {
      _viagemAgendada = true;
      setTimeout(() => { _viagemAgendada = false; viajarPara(idReg); }, 8000);
    }
  }

  /** Espera após o recall: RECALL do motor (s) + folga pra base/UI. */
  const esperaRecallMs = () => Math.max(4000, (META.recall || 4) * 1000) + 5000;

  /** Viaja pra um local do mapa (abre mapa, escolhe o marcador e clica em viajar).
   *
   *  REGRA MEDIDA (log do dono, 2026-10-14):
   *    "16:55 Viajando para Covil do Barão... (3 segundos; Esc, andar, atacar ou levar dano
   *     cancela)" / "16:55 Viagem cancelada: você levou dano".
   *  Ou seja: a viagem e CANCELADA POR DANO, logo so e fiavel a partir da BASE. Varios
   *  chamadores (5221/5235/5244/5264) viajavam do meio do combate e a viagem morria ali — o
   *  boneco ficava preso na regiao errada. A regra passa a viver AQUI, para valer a TODOS os
   *  chamadores (incluindo os que vierem depois), em vez de ser repetida em cada um. */
  let _viagemTent = 0;
  let _viagemAgendada = false;   // guarda: só UMA viagem em voo (evita a cadeia de setTimeout no stub)
  function viajarPara(id) {
    if (/runeterra/i.test(semAcento(String(id || '')))) { logEvent('runeterra', { bloqueado: id }); return { ok: false, motivo: 'runeterra bloqueado' }; }   // Runeterra é manual
    // Nao esta na base? RECALL primeiro e so depois viaja. Sem isto a viagem e cancelada.
    if (!naBase()) {
      if (_viagemTent >= 3) { logEvent('viagem', { desistiu: id, tentativas: _viagemTent }); _viagemTent = 0; return { ok: false, motivo: 'desistiu apos 3 recalls', tentativas: 3 }; }
      _viagemTent++;
      logEvent('viagem', { recall: 'para a base antes de viajar', destino: id, tentativa: _viagemTent });
      press('b');
      setTimeout(() => viajarPara(id), esperaRecallMs());
      return { ok: false, motivo: 'a caminho da base', tentativa: _viagemTent };
    }
    _viagemTent = 0;
    press('m');
    setTimeout(() => {
      const b = document.querySelector(`#marcadores .marcador[data-local="${id}"]`);
      if (b) b.click();
      setTimeout(() => { const ir = document.querySelector(`#mapa-info [data-ir="${id}"]`); if (ir) ir.click(); }, 400);
    }, 700);
    return { ok: true, destino: id };
  }

  // ------------------------------------------------------------- laço (observação)
  let lastAt = 0;
  /** GASTA TODOS OS PONTOS DE HABILIDADE — regra do dono (inviolável):
   *  "Gastar TODOS os pontos: skill points (com a ULTIMATE na barra)".
   *
   *  ORDEM (a que o dono descreveu, e que o motor confirma):
   *   1) DESBLOQUEAR primeiro (rank 0 -> 1): "uma skill desbloqueada faz mais que UM PONTO em
   *      uma skill existente" — e ao chegar a rank 1 ela ENTRA SOZINHA na barra (motor.js:2817).
   *   2) depois SUBIR, pelo GANHO MARGINAL do próximo rank (`valorDoPonto` = dps(r+1) − dps(r)
   *      + o buff do rank) e não pelo DPS absoluto do rank actual.
   *
   *  ORDEM CONCRETA DO YASUO (números do motor, com AD≈209 do estado medido):
   *   Q base serie(40,20) recarga serie(4,−0,15) (motor.js:698) — rank 7→8:
   *     (180+0,55·209)/2,95 − (160+0,55·209)/3,10 ≈ 100 − 88,7 = +11,3 de DPS por ponto;
   *   E base serie(50,18) recarga serie(3,5,−0,15) (motor.js:703) — rank 4→5: ≈ +6,0;
   *   R base serie(200,110,5) recarga [70,60,50,42,35] (motor.js:706) — rank 1→2:
   *     310/60 − 200/70 = 5,2 − 2,9 = +2,3 (e o R só pode ir a rank 2 no nível 14, motor.js:908);
   *   A base serie(60,30) recarga serie(12,−0,5) (motor.js:711) — DESBLOQUEIO (rank 0->1) ≈ +19.
   *   Logo: desbloqueia R/A/G primeiro (rank 0), depois sobe Q > E > W > R.
   *
   *  ANTI-LOOP (bug medido): o laço clicava até 400 vezes e contava `gastos` por CLIQUE, não
   *  por RANK GANHO. Quando o clique não fazia nada (rank no tecto do nível — motor.js:905
   *  `rankMaximoNoNivel`), ele repetia o MESMO clique 400 vezes e dizia `gastos:400`. Agora cada
   *  clique é conferido contra a SOMA DE RANKS lida do DOM e a habilidade que não sobe fica
   *  bloqueada nessa passagem. */
  async function subirHabilidades() {
    if (readSkills().pontos === 0) return { ok: true, gastos: 0, motivo: 'sem pontos livres' };   // HUD dourado escondido = nada a subir
    const tab = q1('[data-aba="habilidades"]');
    if (tab && !tab.classList.contains('ativa')) { tab.click(); await humano(300); }
    const kit = META.kit || {};
    const ctx = ctxDano();
    // PISO de DPS: o MEDIDO (`meuDps`, abates/min × HP do mob) manda; sem histórico, usa-se o
    // DPS de auto-ataque (`dano × velocidade de ataque`) e nunca o dano por golpe sozinho.
    let dpsTotal = ctx.p.dano || 0;
    try { const d = meuDps() || 0; dpsTotal = d > 0 ? d : Math.max(1, (ctx.p.dano || 0) * Math.max(1, ctx.p.va || 1)); } catch { /* ignore */ }
    const somaRanks = () => qa1('#habilidades .hab[data-t]').reduce((s, h) => { const m = (h.textContent || '').match(/(\d+)\s*\/\s*(\d+)/); return s + (m ? +m[1] : 0); }, 0);
    let gastos = 0, desbloqueios = 0;
    const bloqueadas = new Set();
    for (let i = 0; i < 400; i++) {
      const lvl = (player() || {}).nivel || 1;
      const cand = qa1('#habilidades .hab[data-t]').map((h) => {
        const t = h.dataset.t, k = kit[t] || {}, mais = h.querySelector('.mais');
        const rr = ((h.textContent || '').match(/(\d+)\s*\/\s*(\d+)/) || []);
        const dica = h.getAttribute('data-dica') || '';
        const rank = rr[1] ? +rr[1] : 0;
        return { t, mais, rank, dica, liberada: (k.nivel || 1) <= lvl,
          pode: mais && !mais.disabled && mais.getBoundingClientRect().width > 0,
          valor: valorDoPonto(ctx, t, rank, dpsTotal, dica) };
      }).filter((c) => c.liberada && c.pode && !bloqueadas.has(c.t));
      if (!cand.length) break;
      cand.sort((a, b) => {
        const ua = a.rank === 0 ? 0 : 1, ub = b.rank === 0 ? 0 : 1;
        if (ua !== ub) return ua - ub;                                  // 1) DESBLOQUEAR primeiro
        return (b.valor - a.valor) || (b.rank - a.rank) || (a.t < b.t ? -1 : 1);   // 2) ganho marginal; 3) determinístico
      });
      const escolhida = cand[0];
      const antes = somaRanks();
      escolhida.mais.click();
      await esperar(30);
      const depois = somaRanks();
      if (depois > antes) {
        gastos++;
        if (escolhida.rank === 0) { desbloqueios++; logEvent('habilidades', { desbloqueio: escolhida.t, nivel: lvl, valor: Math.round(escolhida.valor) }); }
      } else {
        bloqueadas.add(escolhida.t);                                    // não subiu: não insistir
      }
      if (gastos && gastos % 5 === 0) await humano(60, 120);
      if (cand.length === 1 && depois === antes) break;                 // já não há nada que suba
    }
    if (gastos || desbloqueios) logEvent('habilidades', { gastos, desbloqueios, nivel: (player() || {}).nivel, restantes: readSkills().pontos });
    return { ok: gastos > 0, gastos, desbloqueios };
  }

  /** Pega os PRESENTES: "Pegar e equipar" e o prêmio diário (`#rastreio-login` → `[data-pegar-login]`). */
  async function pegarPresentes() {
    const pegos = [];
    const pe = q1('.presente-pegar');
    if (pe && pe.getBoundingClientRect().width > 0) { pe.click(); pegos.push('presente-pegar'); await humano(700); }
    const rl = q1('#rastreio-login');
    // SÓ clica se o rastreador estiver VISÍVEL: escondido = já pegou hoje (jogo.js:6257) e o
    // clique não faz nada. Era isto que deixava a necessidade `presente` aberta PARA SEMPRE.
    if (rl && rl.hidden !== true && rl.getBoundingClientRect().width > 0) {
      rl.click(); await humano(700);
      const pl = q1('[data-pegar-login]');
      if (pl) { pl.click(); pegos.push('premio-diario'); await humano(700); }
      fecharJanelas();
    }
    if (pegos.length) logEvent('presentes', { pegos });
    return { ok: true, pegos };   // "nada a pegar" é SUCESSO (a necessidade já não existe)
  }

  /** Pula o TUTORIAL quando o botão "Pular tutorial" estiver na tela (conta nova). */
  function pularTutorial() {
    const b = [...document.querySelectorAll('button, a, .botao, [data-pular-tutorial]')].find((x) => {
      const t = (x.textContent || '').trim(); const r = x.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && /^(pular tutorial|pular|skip( tutorial)?|fechar tutorial)$/i.test(t);
    });
    if (b) { b.click(); logEvent('tutorial', { pulou: true }); return true; }
    return false;
  }

  function loop() {
    const now = Date.now();
    if (now - lastAt < 3000) return;
    lastAt = now;
    const pot = readPotions();
    const plan = {
      at: now,
      enabled: cfg.enabled,
      gold: readGold(),
      location: readLocation(),
      potions: pot,
      potionPlan: planPotions(pot),
      region: cfg.regionDefault || (readLocation().range ? `ideal (${readLocation().range.join('–')})` : null),
      skills: readSkills(),
      equip: readEquip(),
    };
    try { chrome.storage.local.set({ [PLAN_KEY]: plan }); } catch { /* ignore */ }
    garantirCampeao();   // auto-corrige o campeao (build/valoração dependem disto)
    checarChefeFatal();
    if (cfg.autoEquip !== false) checarEquipMelhor();
    try { pularTutorial(); } catch { /* ignore */ }
    // passoTeste roda em intervalo próprio de 1 s (mob EXATO) — ver setInterval abaixo
  }

  // ------------------------------------------------------------- rotina de base
  const q1 = (s) => document.querySelector(s);
  const qa1 = (s) => [...document.querySelectorAll(s)];
  const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
  /** Espera "humana": base + jitter aleatório (evita timings perfeitos de bot). */
  const humano = (ms = 300) => esperar(Math.max(70, Math.round(ms * (0.55 + Math.random() * 0.95))));

  function clickNPC(nome) { const b = q1(`#npcs button[data-npc="${nome}"]`); if (b) { b.click(); return true; } return false; }
  async function waitFor(sel, ms = 3000) { const t0 = Date.now(); while (Date.now() - t0 < ms) { const el = q1(sel); if (el) return el; await esperar(120); } return null; }
  function fecharJanelas() { qa1('[data-fechar]').forEach((b) => b.click()); }

  // --------------------------------------------- ANDAR NO CHAO (clicar no canvas)
  /*  MEDICAO (docs/game-src) — tudo o que esta aqui foi LIDO no fonte do jogo, nada foi adivinhado:
   *   · O boneco ANDA ao CLICAR no chao do canvas `#tela`: `jogo.js:1449` (mousedown) exige
   *     `e.button === 2` (botao direito) e chama `comandoDoMouse` (`jogo.js:1433-1446`), que em
   *     Runeterra usa `Arena.mandarAndar` (`arena.js:144-147`) e na Fonte cai em `comandoNaFonte`
   *     (`jogo.js:408-414`) -> `cena.andarPara` (`cena.js:519-531`). O caminho e BFS de 8 direcoes
   *     (`mundo.js:488` `caminho()`).
   *   · ECRAN -> TILE: `k = largCss/(VIS_L*T)` e `tile = floor((cam + x/k)/T)` (`jogo.js:1428-1431`
   *     `pontoDoMouse`; `cena.js:494-497` e `519-520`). O tile mede `T = 32` px (`pixel.js:4`
   *     "export const T = 32; // tamanho do tile") e a janela mostra `VIS_A = 11` tiles de altura
   *     (`cena.js:33` "export const VIS_A = 11;"). O canvas ocupa exactamente essa janela
   *     (`jogo.js:355-359`: `width = VIS_L*T`, `height = VIS_A*T` em px de CSS) => 1 TILE =
   *     `rect.height / VIS_A` px de CSS (e a altura do bitmap e `VIS_A*T*ESCALA`, `cena.js:325/485`).
   *   · ONDE ESTA O BONECO: a camera centra o campeao na janela — `cam.x = pos.x - ((VIS_L-1)/2)*T`
   *     e `cam.y = pos.y - ((VIS_A-1)/2)*T` (`cena.js:4051` `camNoCampeao()` e `cena.js:4060-4067`),
   *     logo o CENTRO do canvas cai no tile do boneco. (A camera SOLTA — tecla Y — so existe em
   *     Runeterra: `cena.js:4061` `const livre = this.camLivre && m.mundo`, e `jogo.js:1310` desliga-a
   *     fora da arena. Na Fonte do Rift nao ha `m.mundo`, logo o centro e sempre o boneco.)
   *  Consequencia pratica (sem ler estado nenhum do jogo): subir N tiles = UM mousedown do botao
   *  direito em (centro-x, centro-y - N * rect.height/VIS_A). */
  const TAM_TILE_JOGO = 32;    // pixel.js:4  — "export const T = 32; // tamanho do tile"
  const VIS_A_JOGO = 11;       // cena.js:33  — "export const VIS_A = 11;"
  const ESCALA_JOGO = 2;       // cena.js:34  — "const ESCALA = 2;" (bitmap = CSS * ESCALA)

  /** Evento de rato. No jogo real tem de ser `MouseEvent` (e o unico que carrega `button`/clientX);
   *  no banco de testes (vm sem MouseEvent) cai para `Event` + as mesmas propriedades — o objecto
   *  que os listeners do jogo leem (`e.button`, `e.clientX`, `e.clientY`) fica igual. */
  function eventoRato(tipo, o) {
    const init = { bubbles: true, cancelable: true, button: o.button, buttons: o.button === 2 ? 2 : 1, clientX: o.clientX, clientY: o.clientY };
    if (typeof MouseEvent === 'function') return new MouseEvent(tipo, init);
    const ev = new Event(tipo, init);
    for (const k of Object.keys(init)) { try { ev[k] = init[k]; } catch { /* ignore */ } }
    return ev;
  }

  /** Clica no chao do canvas `#tela` N tiles ACIMA do boneco (1 clique por tile — o clique move 1 tile).
   *  `opts.ate` (opcional) e chamado DEPOIS de cada tile: se devolver true, para (ex.: o NPC que
   *  esperamos ja apareceu em `#npcs`). Devolve { ok, tiles, motivo }; `tiles` = cliques DISPARADOS. */
  async function andarParaCima(nTiles = 1, opts = {}) {
    const pedidos = Math.max(1, Math.round(Number(nTiles) || 1));
    const cv = q1('#tela');
    if (!cv) return { ok: false, tiles: 0, motivo: 'sem canvas #tela' };
    const esperadoAltura = VIS_A_JOGO * TAM_TILE_JOGO * ESCALA_JOGO;   // cena.js:325 (canvas.height = VIS_A*T*ESCALA)
    if (cv.height && cv.height !== esperadoAltura) return { ok: false, tiles: 0, motivo: 'canvas #tela com altura ' + cv.height + ' (esperava ' + esperadoAltura + '): nao sei converter tile->ecra' };
    const r = (typeof cv.getBoundingClientRect === 'function') ? cv.getBoundingClientRect() : null;
    if (!r || !(r.width > 0) || !(r.height > 0)) return { ok: false, tiles: 0, motivo: 'canvas #tela sem tamanho medivel' };
    const pxTile = r.height / VIS_A_JOGO;             // 1 tile em px de CSS (cena.js:33 + jogo.js:355-359)
    const x = r.left + r.width / 2;                   // o centro cai no tile do boneco (cena.js:4060)
    let tiles = 0;
    for (let i = 0; i < pedidos; i++) {
      const y = r.top + r.height / 2 - pxTile;        // 1 tile acima do boneco
      try { cv.dispatchEvent(eventoRato('mousedown', { button: 2, clientX: x, clientY: y })); }
      catch (e) { return { ok: false, tiles: tiles, motivo: 'nao consegui clicar no chao: ' + e }; }
      tiles++;
      await humano(500);                              // 1 tile = 0,2 s no Rift (cena.js:316/557); em Runeterra 4,4 tiles/s (arena.js:18)
      if (typeof opts.ate === 'function' && opts.ate()) break;
    }
    return { ok: true, tiles: tiles };
  }

  /** SOBE na FONTE — onde a Tesoureira de Piltover fica ACIMA da praca (`mundo.js:19-21` NPCS_FONTE:
   *  `{ nome: 'Tesoureira de Piltover', x: CX - 1, y: CY - 5 }`, com o Burrinho de Carga ao lado,
   *  tambem em `CY - 5`). Fora da Fonte recusa: nas cidades o cofre e o Burrinho, no sitio onde o
   *  boneco esta (motor.js `podeCofre` = base OU cidade). */
  async function subirNaFonte(nTiles = COFRE_TILES_ACIMA, opts = {}) {
    if (!naBase()) return { ok: false, tiles: 0, motivo: 'nao esta na Fonte' };
    return andarParaCima(nTiles, opts);
  }

  /** Cura na base via Soraka. */
  async function curarBase() { if (clickNPC('Soraka')) await humano(320); return true; }

  /** Vende ao Lojista: espólios (lote) + épicos < A. NUNCA lendário A+/Rabadon. */
  /** COMPONENTES DA BUILD IDEAL (recursivo, via o campo `de` do catálogo).
   *  Existe por causa de um BUG MEDIDO: o Tiamat montado por 124.500 de ouro foi
   *  VENDIDO por 600 no Lojista, porque a regra do `venderBase` só olhava raridade
   *  e qualidade — e um épico B é "vendável" por essa regra. Mas o Tiamat é
   *  componente da Hidra Raivosa, que está na build ideal. Componente de build
   *  NUNCA pode ir para o Lojista. */
  let _compCache = null, _compKey = '';
  function componentesDaBuild() {
    // MEMOIZADO: o planBag chama isto a cada passagem; o catálogo não muda entre chamadas.
    let ideal = [];
    try { ideal = (buildIdeal() || []).map(String); } catch { ideal = []; }
    const chave = ideal.join(',');
    if (_compCache && _compKey === chave) return _compCache;
    const out = new Set();
    const itens = META.itens || [];
    const add = (id, depth) => {
      if (depth > 4) return;
      const it = itens.find((x) => String(x.id) === String(id));
      for (const c of ((it && it.de) || [])) {
        const cs = String(c);
        if (!out.has(cs)) { out.add(cs); add(cs, depth + 1); }
      }
    };
    for (const b of ideal) add(b, 0);
    _compCache = out; _compKey = chave;
    return out;
  }

  async function venderBase() {
    const regras = { epicosVendidos: [], protegidos: [] };
    fecharJanelas();
    await humano(280);
    if (!clickNPC('Lojista')) return { ok: false, motivo: 'sem lojista' };
    if (!(await waitFor('#janela-npc [data-palavra="vender"]'))) return { ok: false, motivo: 'sem vender' };
    q1('#janela-npc [data-palavra="vender"]').click();
    const abrir = await waitFor('#janela-npc [data-abrir-venda]');
    if (!abrir) return { ok: false, motivo: 'sem abrir-venda' };
    abrir.click();
    if (!(await waitFor('#janela-venda .cofre-slot[data-separar]'))) return { ok: false, motivo: 'sem janela-venda' };
    await humano(280);
    // conta duplicados na mochila (no Lojista eles JUNTAM no mesmo slot → 1 clique = 1 unidade)
    const dups = {};
    try { for (const s of (scanBag().items || [])) if (s.kind === 'item') dups[s.id] = (dups[s.id] || 0) + 1; } catch { /* ignore */ }
    q1('#janela-venda [data-separar-tipo="espolio"]')?.click();
    await humano(480);
    const lendaBuild = lendariosDaClasse();
    // REGRA DO DONO (equipar): um item que o equipador vai VESTIR a seguir não pode ser
    // vendido — seria o ping-pong mochila↔Lojista (o actor equipa, o planeador vende).
    // Mesma função que o planeador usa (`planoEquipar`), para os dois não discordarem.
    let equiparAgora = new Set();
    try { const pe = planoEquipar(scanBag()); equiparAgora = pe.bases || new Set(); } catch { /* ignore */ }
    const equiparJaProtegido = new Set();   // só UMA cópia por base fica protegida (as outras são duplicados)
    // RECONCILIAÇÃO com o `planBag`: os BÁSICOS que são COMPONENTE da build NÃO se vendem — são a
    // matéria-prima das receitas (o motor monta juntando os `de`, motor.js:383-406). Venderam-se
    // as Adagas/Picaretas/Espadas e o campeão ficou SEM receita nenhuma para arrancar. Vende-se
    // só o EXCEDENTE acima do tecto que a receita pede (`basicosDaBuild`).
    const necBas = basicosDaBuild(META.champAtual);
    const porBaseBag = {}; const vendidosPorBase = {};
    let transbordo = 0;
    try {
      const b2 = scanBag();
      for (const s2 of (b2.items || [])) if (s2.kind === 'item') porBaseBag[s2.base] = (porBaseBag[s2.base] || 0) + 1;
      transbordo = Math.max(0, (b2.used || 0) - (b2.cap || 0));
    } catch { /* ignore */ }
    for (const s of qa1('#janela-venda .cofre-slot[data-separar]')) {
      const id = s.dataset.separar || ''; const dica = s.dataset.dica || '';
      if (id.startsWith('esp:')) continue;                       // espólio já foi em lote
      const puro = id.replace(/[+~].*$/, '');                    // '3089+2~A' → '3089'
      if (ehPrioridadeExtrema(puro)) continue;                   // PRIORIDADE EXTREMA (3031/3089, automation.js:47): nunca vai ao Lojista — nem duplicado (antes só o Rabadon era poupado aqui)
      // TRATAMENTO ESPECIAL POR CAMPEÃO (ver ITENS_ESPECIAIS): o motor lê estes itens pelo
      // ID para mudar a REGRA do campeão (ex.: motor.js:515 Gume do Infinito, motor.js:522
      // Rabadon). Um deles DA MINHA CLASSE nunca vai ao Lojista.
      if (ehEspecialMeu(puro)) { const e = especialDe(puro); regras.protegidos.push({ id, motivo: 'tratamento especial (' + e.papel + '/' + e.tipo + '): ' + e.motivo + ' [' + e.fonte + ']' }); continue; }
      if (equiparAgora.has(String(puro)) && !equiparJaProtegido.has(String(puro))) { equiparJaProtegido.add(String(puro)); regras.protegidos.push({ id, motivo: 'vai ser EQUIPADO (melhor do slot) — nunca vender' }); continue; }
      const mq = id.match(/~([A-Za-z?]{1,2})$/);
      if (!mq || !QUAL.includes(mq[1].toUpperCase())) { regras.protegidos.push({ id, motivo: "qualidade '?'/ilegível — nunca mexer" }); continue; }
      const qual = mq[1].toUpperCase();
      const lend = /lend[áa]rio/i.test(dica), epi = /[ée]pico/i.test(dica);
      if (lend && lendaBuild.has(String(puro))) { regras.protegidos.push({ id, motivo: 'lendário da build da classe' }); continue; }
      // L4 (regra do dono): LENDÁRIO DUPLICADO com o mercado SATURADO fica na MOCHILA — nunca ao
      // Lojista nem anunciado. A contagem de duplicados é o `dups` do topo desta função (3032).
      if (lend && mercadoSaturado().sat) {   // L4: mercado saturado -> o lendario NAO vai ao Lojista
        regras.protegidos.push({ id, motivo: 'duplicata de lendário — mercado saturado (fica na mochila)' });
        continue;
      }
      // PEÇAS RESERVADAS DAS DUAS BUILDS (mob × chefe): NUNCA vão ao Lojista — são as peças da
      // build da outra fase (o que sai da troca fica na mochila). Vem DEPOIS do lendário-da-build
      // para o motivo desse caso continuar a ser o dele (o banco de regressão fixa essa string).
      if (ehReservado(puro)) { const fsR2 = fasesDoItem(puro); regras.protegidos.push({ id, motivo: 'peça da build de ' + (fsR2.length ? fsR2.join(' + ') : 'fase') + ' — reservada para a troca por fase' }); continue; }
      // REGRA DO DONO: só tier S ou acima é intocável. A NÃO está protegido ("basico, epico,
      // duplicado: vende no lojista. a nao ser q seja tier s mais").
      if (qIdx(qual) >= qIdx('S')) continue;                     // S / SS: NÃO MEXE (qualquer raridade)
      // Lojista: épico SEMPRE; lendário <A SÓ se o mercado saturou de lendários (regra exata)
      // BASICO e EPICO <A vao para o Lojista. LENDARIO <A so se o mercado saturou.
      // BUG CORRIGIDO: a guarda antiga era `if (!epi && !(lend && mercadoSaturado().sat)) continue;`
      // e com isso SALTava TODOS os basicos. O planBag marca-os VENDER_LOJISTA (medido:
      // lixo=16 numa mochila de 21 basicos) -> ator e planeador discordavam, a mochila
      // NUNCA esvaziava, o supervisarBase ficava em 'mochila cheia' para sempre e o
      // boneco andava base<->mapa sem farmar. Era ESTE o ciclo fechado do Yasuo na Fonte.
      // COMPONENTE DA BUILD: nunca vender. Sem esta guarda, um épico montado (ex.: o
      // Tiamat, 124.500 de ouro) era vendido por 600 — medido no log do jogo.
      // Só ÉPICO+ é protegido: os BÁSICOS são matéria-prima e devem continuar vendáveis
      // (o banco de regressão apanhou a versão larga, que protegia básicos também).
      // O que se perdeu foi um ÉPICO montado — o Tiamat, 124.500 de ouro, vendido por 600.
      // Usa a RARIDADE DO CATÁLOGO (não a dica do slot): é a fonte fiável. Um item de
      // raridade 'epico' que sirva de componente à build ideal nunca vai para o Lojista.
      const catIt = (META.itens || []).find((x) => String(x.id) === String(puro));
      if (catIt && catIt.raridade === 'epico' && componentesDaBuild().has(String(puro))) { regras.protegidos.push({ id, motivo: 'componente da build ideal (epico do catalogo)' }); continue; }
      // BÁSICO COMPONENTE: guarda até ao tecto da receita, vende só o excedente (MESMA regra do
      // `planBag` — sem esta reconciliação voltava o ping-pong mochila<->Lojista).
      if (catIt && catIt.raridade === 'basico' && componentesDaBuild().has(String(puro))) {
        const tenho = porBaseBag[puro] || 0;
        const jaVendi = vendidosPorBase[puro] || 0;
        // TRANSBORDO: com a mochila acima da capacidade o tecto desce pelo tamanho do transbordo
        // (MESMA ideia do `planBag` — é o que garante que a mochila drena e o loot não para).
        const tetoEf = Math.max(0, (necBas[puro] || 0) - transbordo);
        const podeVender = Math.max(0, tenho - tetoEf - jaVendi);
        if (podeVender <= 0) { regras.protegidos.push({ id, motivo: 'básico componente da build (' + tenho + '/' + (necBas[puro] || 0) + ')' }); continue; }
        const vezesC = Math.min(dups[id] || 1, podeVender);
        vendidosPorBase[puro] = jaVendi + vezesC;
        for (let k = 0; k < vezesC; k++) { s.click(); regras.epicosVendidos.push(id); await humano(120); }
        continue;
      }
      // REGRA DO DONO (2026-10-14, verbatim): "lendarios sao desejados pelos jogadores, entao nunca
      // se vende lendario pelo lojista, so pelo mercado". -> o LENDÁRIO nunca é clicado aqui, nem
      // com o mercado saturado (antes: `if (lend && !mercadoSaturado().sat) continue;` deixava-o
      // cair no Lojista quando o mercado estava cheio). O actor e o planeador têm de concordar.
      if (lend) { regras.protegidos.push({ id, motivo: 'lendário NUNCA vai ao Lojista (regra do dono: vai ao mercado)' }); continue; }
      const n = dups[id] || 1;
      const vezes = n;                                             // sub-A vai pro Lojista inteiro (o dedupe-1 é do CAMINHO DO ANÚNCIO, planBag)
      for (let k = 0; k < vezes; k++) { s.click(); regras.epicosVendidos.push(id); await humano(120); }
    }
    await humano(380);
    q1('#janela-venda [data-vender-cesta]')?.click();
    await humano(850);
    fecharJanelas();
    return { ok: true, ...regras };
  }

  /** Repõe poções no Lojista: P1>200, P2>100, P3>30; compra o LOTE 3.000/1.500/700 (mais caras primeiro).
   *
   *  P0 MEDIDO AO VIVO: esta função dizia `ok:true` mesmo quando NÃO conseguia comprar (o
   *  botão da Poção Suprema vem `disabled` abaixo do nível 30 — motor.js:264). Como a
   *  necessidade `repor` nunca fechava, o boneco entrava no ciclo "viaja, mata 1 mob, volta à
   *  base, não compra, sai". Agora: (a) só se tenta o que a LOJA VENDE ao nível dele
   *  (`pocaoCompravel`); (b) o sucesso é medido contra o MÍNIMO (`minimoPocoesAgora`), não
   *  contra a intenção; (c) devolve `ok:false` + `faltou` quando sobra falta. */
  async function reporPocoes() {
    const alvo = { vidaS: 30, vidaF: 100, vida: 200 };      // stock SAUDÁVEL (o que se tenta encher)
    const lote = { vidaS: 700, vidaF: 1500, vida: 3000 };
    const min = minimoPocoesAgora();                        // o que CONTA como necessidade
    const compraveis = ['vidaS', 'vidaF', 'vida'].filter(pocaoCompravel);
    const p = readPotions();
    const falta = compraveis.filter((k) => (p[k] || 0) < alvo[k]);
    const sobrou = () => Object.keys(min).filter((k) => (readPotions()[k] || 0) < min[k]);
    if (!falta.length) return { ok: true, nada: true, min, compraveis, faltou: sobrou() };
    if (!clickNPC('Lojista')) return { ok: false };
    if (!(await waitFor('#janela-npc [data-palavra="comprar"]'))) return { ok: false, motivo: 'sem comprar' };
    q1('#janela-npc [data-palavra="comprar"]').click();
    if (!(await waitFor('#janela-npc [data-comprar]'))) return { ok: false, motivo: 'sem botoes' };
    await humano(280);
    const feitos = {};
    const semBotao = [];
    for (const k of compraveis) {                               // mais caras primeiro
      const antes = readPotions()[k] || 0;
      if (antes >= alvo[k]) continue;                             // já tem o suficiente — NÃO compra de novo
      const inp = q1(`#janela-npc [data-qtd="${k}"]`);
      const btn = q1(`#janela-npc [data-comprar="${k}"]`);
      if (!inp || !btn || btn.disabled) { semBotao.push(k); continue; }   // nível baixo / sem botão
      // DRENO MEDIDO: comprava o LOTE INTEIRO (vida: 3000 x 40 = 120.000 de ouro) sempre que o
      // stock caísse abaixo do mínimo. Resultado: o ouro nunca acumulava — caiu de 59.500 para
      // 3.812 e ele ficou com 1570 poções de vida. O lote existe para não clicar 3000x, mas tem
      // de respeitar uma RESERVA: compra o que o ouro permite deixando 20.000 de lado.
      const precoK = PRECO_POCAO[k] || 0;
      const ouroAgora = readGold();
      const maxPorOuro = precoK > 0 ? Math.max(0, Math.floor((ouroAgora - 20000) / precoK)) : lote[k];
      const quer = Math.max(0, Math.min(lote[k], maxPorOuro));
      if (quer <= 0) continue;                                   // sem ouro para repor: não compra
      inp.value = String(quer);                                  // COMPRA DE UMA VEZ (não clicar 3000x)
      inp.dispatchEvent(new Event('input', { bubbles: true }));
      await humano(150);
      btn.click();
      await esperar(850);
      feitos[k] = Math.max(0, (readPotions()[k] || 0) - antes);
    }
    await humano(420);
    q1('#janela-npc [data-fechar]')?.click();
    // SUCESSO = o MÍNIMO ficou satisfeito (não "eu tentei"). `faltou` é a lista que o
    // `necessidadesBase`/`acaoBase` usam para decidir se a necessidade fecha.
    const faltou = sobrou();
    return { ok: faltou.length === 0, feitos, faltou, semBotao, min, compraveis, motivo: faltou.length ? ('nao consegui comprar: ' + faltou.join(',')) : null };
  }

  /** Rotina completa na base: vender espólio → curar → repor poção. */
  let baseLock = false;   // MUTEX da base: nenhuma rotina de base/viajar roda em paralelo
  let baseLockAt = 0;     // quando o lock foi tomado (para ele poder EXPIRAR)
  // Teto de vida do mutex e teto por passo. Antes, um passo lento (ex.:
  // comprarNoMercado a 13,5 s, ou uma rotina completa de 60-90 s) prendia o
  // baseLock e o supervisarBase respondia 'base ocupada (mutex)' indefinidamente
  // -> o boneco nunca chegava ao ramo de viajar. O lock tem de ser auto-curável.
  const BASE_LOCK_MS = 150000, PASSO_MS = 45000;

  // ---------------------------- NECESSIDADES QUE FALHARAM ("não há como satisfazer isto agora")
  /** P0 MEDIDO AO VIVO (ciclo de recall): uma necessidade que o passo NÃO consegue fechar
   *  (ex.: a Poção Suprema, que a loja só vende no nível 30 — motor.js:264) era re-pedida a
   *  cada 20 s. O boneco viajava, matava 1 mob, voltava à base, não comprava, saía... para
   *  sempre. Agora uma necessidade que falhou fica SILENCIOSA por `INDISPONIVEL_MS` e só é
   *  tentada outra vez quando o prazo expira. O motivo vai para o log (o dono tem de VER
   *  "não consigo comprar X" em vez de ping-pong silencioso). */
  const INDISPONIVEL_MS = 45 * 60 * 1000;   // 45 min
  let _indisponivel = {};
  function marcarIndisponivel(chave, motivo) {
    if (!PASSOS_CHAVES.has(chave)) return;
    _indisponivel[chave] = Date.now();
    logEvent('base', { indisponivel: chave, motivo: motivo || null, ttlMin: Math.round(INDISPONIVEL_MS / 60000) });
  }
  const estaIndisponivel = (chave) => { const t = _indisponivel[chave]; return !!t && (Date.now() - t) < INDISPONIVEL_MS; };
  function limparIndisponivel(chave) { if (_indisponivel[chave]) delete _indisponivel[chave]; }
  /** O PASSO falhou? Um passo só conta como FALHA quando DIZ que falhou (`ok:false`), deu
   *  timeout, ou lançou erro. Arrays e `true` são SUCESSO (é o que `pegarPresentes` e
   *  `curarBase` devolvem); `{nada:true}` (não havia nada a fazer) também é sucesso. */
  function passoFalhou(r) {
    if (r == null) return true;
    if (Array.isArray(r) || typeof r === 'boolean') return r === false;
    return r.ok === false || r.timeout === true || r.erro != null;
  }
  /** Há algum LENDÁRIO A+ da build EQUIPADO abaixo do teto de refino? (só LEITURA — é isto
   *  que torna `n.refino` uma necessidade SATISFAZÍVEL em vez de um `true` eterno.)
   *  Teto e alvo são os MESMOS de `refinarMelhores` (motor.js:258 `precoRefino`, e a regra do
   *  dono "ao conseguir um dos itens ESSENCIAIS, tier A ou mais, pode refinar"). */
  function precisaRefino() {
    const teto = (cfg.refinoMax != null ? cfg.refinoMax : 2);
    let medido = null, divergenciaMedido = [];
    let essenciais = [];
    try { essenciais = (buildIdeal() || []).map(String); } catch { essenciais = []; }
    try {
      return readEquip().some((e) => {
        const it = (META.itens || []).find((x) => String(x.id) === e.base);
        return !!(it && it.raridade === 'lendario' && qIdx(e.qual) >= qIdx('A') && (e.refino || 0) < teto && essenciais.indexOf(String(e.base)) >= 0);
      });
    } catch { return false; }
  }
  /** CUSTO de uma ida à base, em OURO-EQUIVALENTE. Derivado, não inventado:
   *   - VIAGEM: `esperaRecallMs()` (o recall do motor + folga) + ~8 s da volta pelo mapa;
   *   - o que se DEIXA DE FARMAR nesse tempo: o score da região (ouro+xp, ver `scoreRegiao`)
   *     convertido a ouro pela taxa do próprio motor (`taxaXpOuro`), por segundo.
   *  É isto que impede "vender 1 item de 21 de ouro": o dono viu o ouro CONGELADO em 52.300
   *  enquanto o boneco andava Fonte<->Rota Superior a vender um item de cada vez. */
  /** FIM DO "COMEÇO DO JOGO" (excepção do dono ao Lojista não pagar): o fim da PRIMEIRA faixa do
   *  mapa — `LOCAIS.rota-inf.faixa = [1, 10]` (motor.js:357, a região "por onde todo mundo
   *  começa"). Derivado do META (medido, não inventado); `cfg.inicioJogoAteNivel` sobrepõe. */
  const fimDoComeco = () => {
    const l = (META.locais || []).find((x) => x.id === 'rota-inf');
    return numOr(cfg.inicioJogoAteNivel, (l && l.faixa && l.faixa[1]) || 10);
  };
  let _custoCache = null, _custoAt = 0;
  function custoIdaBase() {
    if (_custoCache && Date.now() - _custoAt < 30000) return _custoCache;   // cache 30 s: isto chama o `estimarRegiao`
    let porSeg = 0;
    try {
      const id = localId(readLocation().text) || regiaoIdeal();
      const e = id ? estimarRegiao(id) : null;
      if (e) porSeg = scoreRegiao(e, 'ouro+xp', null) / Math.max(0.01, taxaXpOuro(e.mobLevel || 1)) / 60;
    } catch { /* ignore */ }
    if (!(porSeg > 0)) porSeg = 20;                      // piso conservador (20 de ouro/s)
    const seg = Math.round(esperaRecallMs() / 1000) + 8; // recall + volta pelo mapa
    _custoCache = { ouro: Math.round(porSeg * seg), seg, porSeg: Math.round(porSeg) };
    _custoAt = Date.now();
    return _custoCache;
  }
  /** NECESSIDADES que, SOZINHAS, pagam a viagem à base. As outras (`comprar`, `montar`,
   *  `refino`, `mercado`) são OPORTUNIDADES: só se aproveitam se ele JÁ tiver de ir à base por
   *  uma destas. Sem isto, cada oportunidade de 10 min forçava uma viagem que não se pagava. */
  // `buscar` entrou como PRIMÁRIA (2026-10-14): ir buscar ao cofre uma peça da build da fase
  // NÃO é uma oportunidade — é o que faz a build existir. As oportunidades continuam a ser
  // `comprar`/`mercado`/`refino`/`montar`/`lerCofre` (essas só se aproveitam numa viagem que
  // já ia acontecer).
  // `lerCofre` passou a PRIMÁRIA (pedido do dono: "andar pra fonte ... tem q fazer automatico"): é
  // ela que PAGA a ida à Fonte de X em X minutos para ler o cofre. A cadência (`cfg.cofreCadenciaMin`)
  // limita-o, logo não é o need-eterno que causava o ciclo de recall.
  const NECESSIDADES_PRIMARIAS = ['presente', 'cura', 'vender', 'repor', 'tarefa', 'hab', 'atrib', 'equip', 'buscar', 'cofre', 'anunciar', 'lerCofre'];
  /** NECESSIDADES da base (só o que FALTA) — evita rodar tudo à toa a cada visita. */
  // =======================================================================================
  // HIERARQUIA DE INTERRUPTORES (pedido do dono, 2026-10-14, verbatim):
  //   "faca o autoplay ser um switch que liga varios switchs. e o usuario pode desligar um
  //    deles, e cada switch pode depender de outro. entao faca switches dentro de outros e etc.
  //    uma hierarquia. mas nao faca de forma burra ou bloated. e tem coisas implicitas no
  //    switch. tipo se vender item sozinho, deve voltar pra onde estava antes de vender o item.
  //    tem excecoes: se tiver no mapa de runeterra, nao vai vender. e skippado"
  //
  // DESENHO: UMA tabela + UM resolvedor. Cada interruptor declara:
  //   pai     -> quem tem de estar ligado para este poder ligar (hierarquia)
  //   cfg     -> a chave em `cfg` que o dono controla (null = nao ha toggle, e implicito)
  //   excecao -> predicado opcional; se devolver true, este interruptor e SKIPPADO
  // `podeFazer` sobe a cadeia de pais. Nao ha ifs aninhados em lado nenhum: adicionar um
  // interruptor novo e UMA linha nesta tabela, e ele herda a hierarquia e as excepcoes.
  // =======================================================================================
  const INTERRUPTORES = {
    // MESTRE. REGRA DO DONO (inviolavel): "AUTO-PLAY SO NO YASUO. A Katarina tem de ficar
    // enabled=false. Verificar sempre." MEDIDO 2026-10-14: o `enabled` da Katarina voltou a
    // `true` sozinho (provavelmente num reload/escrita de config) e ela ficou com 5 necessidades
    // ACTIVAS (vender/equip/montar/comprar/lerCofre) - o auto-play a agir contra a regra.
    // Verificar a mao nao chega. Passa a ser IMPOSSIVEL POR CONSTRUCAO: o mestre tem excepcao
    // de campeao, logo com `enabled:true` num campeao que nao o alvo NADA abre. `champAlvo`
    // e configuravel (default 'yasuo'); `null` desliga a excepcao e volta a valer so o toggle.
    // DOIS MESTRES — a distincao e do dono (verbatim): "o auto play e pra decidir tudo pelo
    // usuario... ja vender itens pro lojista, botar no mercado e etc, deve ser RECURSO PADRAO DO
    // SCRIPT. entenda como que e a diferenca e faca por padrao essas coisas ativadas".
    //   manutencao = RECURSO BASE (vender, equipar, mercado, pontos, cofre). Nao e auto-play.
    //                Liga por DEFEITO e nao depende do campeao alvo.
    //   autoplay   = JOGAR sozinho (farmar, viajar, chefes, escolher regiao). So no campeao alvo.
    // Antes TUDO pedia do `autoplay`, e por isso na Katarina (enabled=false) a mochila enchia a
    // 29/30, a ultimate ficava fora da barra e um item melhor ficava na mochila por equipar.
    manutencao:   { pai: null,        cfg: 'manutencao' },
    autoplay:     { pai: null,        cfg: 'enabled', excecao: () => !ehCampeaoAlvo(), excecaoTxt: 'so corre no campeao alvo' },
    // ramo da BASE: tudo o que exige ir a Fonte. `irBase` e implicito (nao tem toggle).
    irBase:       { pai: 'manutencao', cfg: null },
    vender:       { pai: 'irBase',    cfg: null,   excecao: () => ehRuneterra(), excecaoTxt: 'skippado em Runeterra' },
    repor:        { pai: 'irBase',    cfg: null },
    comprar:      { pai: 'irBase',    cfg: 'autoComprar' },
    refino:       { pai: 'irBase',    cfg: 'autoRefino' },
    montar:       { pai: 'irBase',    cfg: 'autoMontar' },
    cofre:        { pai: 'irBase',    cfg: null,   excecao: () => ehRuneterra(), excecaoTxt: 'skippado em Runeterra' },
    // FUGA = SOBREVIVÊNCIA, não auto-play (correcção do Lead, 2026-10-14): estava presa ao
    // mestre do auto-play (`cfg.enabled`), que tem excepção de campeão — na Katarina
    // (`enabled=false`) o boneco NÃO fugia e morria. Pende da MANUTENÇÃO, com cfg própria.
    fugir:        { pai: 'manutencao', cfg: 'fugir' },
    // ramo do CAMPO: nao exige a base
    equip:        { pai: 'manutencao', cfg: 'autoEquip' },
    atrib:        { pai: 'manutencao', cfg: 'autoAtrib' },
    hab:          { pai: 'manutencao', cfg: null },
    anunciar:     { pai: 'manutencao', cfg: null,  excecao: () => ehRuneterra(), excecaoTxt: 'skippado em Runeterra' },
    buildPorFase: { pai: 'autoplay',  cfg: 'buildPorFase' },
    // A TROCA DA BARRA É RECURSO BASE, NÃO FARMAR (correcção do Lead, 2026-10-14; queixa do dono
    // verbatim: "e o negocio de trocar habilidades sozinho no combate, tem que ser usado sempre,
    // em farm. agora tem 4 skills no slots, paradas. nao ta trocando como antigamente").
    // Estavam debaixo do `autoplay`, que tem EXCEPÇÃO DE CAMPEÃO (`!ehCampeaoAlvo()`): na Katarina
    // (enabled=false) a barra NUNCA convergia — MEDIDO ao vivo: barra [Q,A,G,F] contra a ideal
    // [R,Q,A,W], com a ULTIMATE fora (regra inviolável do dono). Passam para a MANUTENÇÃO, como o
    // equipar e o gastar pontos: a barra troca em QUALQUER campeão. O `buildPorFase` FICA no
    // autoplay (esse depende do contexto de luta, é jogar).
    skillsPorFase:{ pai: 'manutencao', cfg: 'skillsPorFase' },
    rotacao:      { pai: 'manutencao', cfg: 'rotacaoSkills' },
    // WATCH-LIST DO MERCADO (pedido do dono, 2026-10-18): vigiar itens e jogadores em tempo
    // real e auto-comprar. Pende da MANUTENCAO (recurso base, funciona em qualquer campeao),
    // com o seu proprio liga/desliga. A compra exige estar no Mercador (naBase()).
    vigiarMercado: { pai: 'manutencao', cfg: 'autoVigiarMercado' },
  };
  /** Este interruptor pode agir AGORA? Sobe a cadeia de pais e avalia a excepcao.
   *  Devolve { pode, porque } — o `porque` e para a GUI poder dizer PORQUE esta desligado. */
  function podeFazer(nome) {
    let n = String(nome || ''), guarda = 0;
    while (n && INTERRUPTORES[n] && guarda++ < 16) {
      const s = INTERRUPTORES[n];
      try { if (s.cfg && cfg[s.cfg] === false) return { pode: false, porque: n + ': desligado pelo dono' }; } catch { /* ignore */ }
      try { if (s.excecao && s.excecao()) return { pode: false, porque: n + ': excepcao activa' }; } catch { /* ignore */ }
      n = s.pai;
    }
    return { pode: true, porque: null };
  }
  /** Lista plana da hierarquia (para a GUI desenhar interruptores dentro de interruptores). */
  function arvoreInterruptores() {
    // `excecaoTxt` (pedido do subagent da GUI): o MOTOR diz o texto da excepcao, em vez de a
    // GUI ter um mapa proprio — sem isto, um interruptor novo com excepcao ficava com texto
    // generico ate alguem se lembrar de tocar na GUI.
    return Object.keys(INTERRUPTORES).map((k) => ({ nome: k, pai: INTERRUPTORES[k].pai,
      cfg: INTERRUPTORES[k].cfg, temExcecao: !!INTERRUPTORES[k].excecao,
      excecaoTxt: INTERRUPTORES[k].excecaoTxt || null, ...podeFazer(k) }));
  }

  // REGRA IMPLICITA DO DONO (2026-10-14, verbatim): "tem coisas implicitas no switch. tipo se
  // vender item sozinho, deve voltar pra onde estava antes de vender o item." -> guardamos a
  // regiao do CAMPO onde ele estava. Sem isto, depois de vender ele saltava para a `regiaoIdeal`
  // e podia acabar num sitio diferente daquele onde estava a farmar.
  /** O campeao actual e o ALVO do auto-play? (regra do dono: so o Yasuo). Fail-open: sem
   *  campeao identificado NAO bloqueia - um seletor que mude nao pode desligar tudo. */
  function ehCampeaoAlvo() {
    try {
      const alvo = cfg.champAlvo === undefined ? 'yasuo' : cfg.champAlvo;
      if (alvo == null) return true;                       // excepcao desligada pelo dono
      const id = String(((META.champAtual || {}).id) || '').trim().toLowerCase();
      if (!id) return true;                                // HUD ainda nao carregou: fail-open
      return id === String(alvo).trim().toLowerCase();
    } catch { return true; }
  }
  let _regiaoAntesDaBase = null;
  /** Regiao onde o boneco estava ANTES de ir a base (null se nunca esteve no campo). */
  const regiaoAntesDaBase = () => _regiaoAntesDaBase;

  function necessidadesBase() {
    // Amostra a regiao do CAMPO a cada passagem (barato, e o `readLocation` ja e lido adiante).
    // SÓ MEMORIZA ZONA SEGURA (correcção do Lead, 2026-10-14): a memória é o que decide o
    // "voltar para onde estava" — guardar uma zona de morte era mandá-lo de volta para lá.
    try { const _l = readLocation(); if (_l && !/fonte/i.test(_l.text || '')) { const _id = localId(_l.text); if (_id && regiaoSegura(_id)) _regiaoAntesDaBase = _id; } } catch { /* ignore */ }
    const n = {};
    let bag = null;
    // CUSTO da ida à base (em ouro-equivalente) — é contra ele que as decisões de IR são
    // medidas. Ver `custoIdaBase`. Declarado AQUI porque `n.vender`/`n._custoIda` o usam.
    const custo = custoIdaBase();
    try { const pl = player() || {}; n.cura = (pl.vida || 0) < (pl.vidaMax || pl.max || 0); } catch { n.cura = false; }
    // P0 AO VIVO (ciclo de recall): usava `minimoPocoes()`, que inclui a POÇÃO SUPREMA — e a
    // loja só a vende no nível 30 (motor.js:264). Com `vidaS: 0` e mínimo 8, isto ficava
    // `true` PARA SEMPRE: o boneco recordava, não conseguia comprar, saía, e voltava 20 s
    // depois. Agora mede contra `minimoPocoesAgora()` (só o que a LOJA VENDE ao nível dele).
    // REPOR — só quando o stock está MESMO no piso (metade do mínimo), não por margem: uma ida
    // à base por 3 poções custa mais do que as poções (ver `custoIdaBase`). A banda de metade é
    // a histerese que evita ir à base a cada abate.
    try {
      const p = readPotions(); const mn = minimoPocoesAgora();
      n.repor = podeFazer('repor').pode && ['vida', 'vidaF', 'vidaS'].some((k) => mn[k] > 0 && (p[k] || 0) < Math.max(1, Math.floor(mn[k] * 0.5)));
      n._pocoes = { stock: p, min: mn };
    } catch { n.repor = true; }
    try {
      bag = scanBag(); const pl = bag ? planBag(bag) : null; const acts = (pl && pl.acts) || [];
      // VENDER — REGRA DE OURO (P0 ao vivo): NÃO basta haver 1 item vendável. Um item de 21 de
      // ouro nunca paga 8-20 s de viagem + os abates perdidos; o que trava o farm é a MOCHILA
      // CHEIA (deixa de entrar loot). Logo: vender só quando a mochila está quase cheia, OU
      // quando o que há para vender já paga a viagem com folga (2x).
      const atosVenda = acts.filter((a) => a.action === 'VENDER_LOJISTA');
      // VALOR REAL da peça: o `vendaLojista` vem do TOOLTIP do jogo (a verdade do ecrã) e, quando
      // o slot não traz esse texto, cai no `valorVenda` do MOTOR (motor.js:257) em vez de ZERO.
      // ATENÇÃO (regra do dono, verbatim): "sobre o lojista, to falando que o dinheiro e tao pouco
      // que e a mesma coisa que so usar ele como lixo" -> isto NÃO é receita, em NENHUMA fase.
      // Fica como INFORMAÇÃO (para o log/painel ver o que foi descartado).
      const valorDaVenda = atosVenda.reduce((s, a) => s + (a.it.vendaLojista || valorVenda(a.it.base, a.it.qual, a.it.refino) || 0), 0);
      // COMEÇO DO JOGO = fim da PRIMEIRA faixa do mapa (`LOCAIS.rota-inf.faixa = [1,10]`, motor.js:357).
      const inicioJogo = (player().nivel || 1) <= fimDoComeco();
      const folga = (cfg.venderFolga != null ? cfg.venderFolga : 2);
      const mochilaQuaseCheia = !!(bag && bag.used >= Math.max(1, bag.cap - folga));
      // A DECISÃO É POR ESPAÇO E POR PRIORIDADE, NÃO POR OURO (regra do dono): o Lojista é descarte.
      //  - ESPAÇO: mochila quase cheia (deixa de entrar loot) -> vai vender SEMPRE;
      //  - PRIORIDADE: o `planBag` já marcou o item para o Lojista (lixo/épico/duplicado — regra
      //    inviolável do dono) e há pelo menos um -> vai vender;
      //  - OURO: NUNCA. O ouro do Lojista não entra em decisão nenhuma (R1, regra do dono).
      // R1 (regra do dono, verbatim): "sobre o lojista, to falando que o dinheiro e tao pouco que e a
      // mesma coisa que so usar ele como lixo" -> o OURO DO LOJISTA NÃO ENTRA EM DECISÃO NENHUMA.
      // A ida ao Lojista é motivada por ESPAÇO (a mochila a transbordar) e pelo que é LIXO — o
      // `planBag` já decidiu isso (`prioridade`), não se inventa critério novo.
      const prioridade = atosVenda.length > 0;
      n.vender = podeFazer('vender').pode && prioridade && mochilaQuaseCheia;
      // `valor` fica como INFORMAÇÃO; `receita` é o que conta como OURO (0 fora do começo do jogo) —
      // é esta marcação explícita que impede alguém de voltar a somar isto como ganho.
      // `valor` = INFORMAÇÃO (o dono vê o que desperdiçou); `receita` = 0 SEMPRE — o ouro do Lojista
      // não entra em contabilidade nenhuma (R1). `inicioJogo` fica registado só como contexto.
      n._venda = { itens: atosVenda.length, valor: valorDaVenda, receita: 0, inicioJogo,
        motivo: mochilaQuaseCheia ? 'espaco' : 'prioridade',
        mochilaQuaseCheia, used: bag && bag.used, cap: bag && bag.cap, espolios: bag && bag.espacosEspolio };
      n.cofre = podeFazer('cofre').pode && acts.some((a) => a.action === 'GUARDAR_COFRE');
      n.anunciar = podeFazer('anunciar').pode && acts.some((a) => a.action === 'ANUNCIAR_MERCADO');
    } catch { /* ignore */ }
    // PRESENTE — P0 MEDIDO AO VIVO (o ciclo que restava): o `#rastreio-login` está SEMPRE no DOM
    // (é um rastreador do HUD) e o jogo só o ESCONDE quando não há nada a pegar — jogo.js:6257
    // `bl.hidden = !pl || pl.pegouHoje`. O `q1()` devolve o elemento mesmo escondido, logo
    // `!!q1('#rastreio-login')` era um `true` ETERNO: `presente` é uma necessidade PRIMÁRIA, o
    // `falta` nunca fechava e o boneco voltava à base a cada 20 s — e era nessa ida que o
    // `venderBase` da rotina vendia 1 item de 21 de ouro. Agora exige VISIBILIDADE.
    try {
      const pe = q1('.presente-pegar'), rl = q1('#rastreio-login');
      const visivel = (e) => !!e && e.hidden !== true && e.getBoundingClientRect().width > 0;
      n.presente = visivel(pe) || visivel(rl);
      n._presente = { pe: !!pe, rl: !!rl, rlEscondido: rl ? !!rl.hidden : null };
    } catch { n.presente = false; }
    // TAREFA — o `!st.tem` (sem tarefa) era um `true` ETERNO: o `_ultimaTarefa` de 5 min só
    // travava o LOG do `supervisarBase`, não a necessidade. Agora a necessidade tem o MESMO
    // throttle — sem isto ele ia buscar uma tarefa a cada 20 s quando não havia tarefa nenhuma.
    try {
      const st = tarefaEstado() || {};
      n.tarefa = !!st.pronta || (!st.tem && (Date.now() - _ultimaTarefa) > 300000);
      n._tarefa = { tem: !!st.tem, pronta: !!st.pronta, esperaMs: Date.now() - _ultimaTarefa };
    } catch { n.tarefa = false; }
    // PONTOS DE SKILL: a necessidade é "há pontos por gastar" (antes bastava `readSkills().pontos`,
    // que já era isto — mantido).
    try { n.hab = podeFazer('hab').pode && readSkills().pontos > 0; } catch { n.hab = false; }
    // PONTOS DE ATRIBUTO: `n.atrib` era `!!cfg.autoAtrib` (um `true` ETERNO, nunca satisfeito —
    // era uma das razões do `ok:false`/ping-pong). Agora é uma necessidade REAL: só pede o passo
    // quando o HUD diz que há pontos de ATRIBUTO por gastar (`readSkills().pontosAtrib`).
    try { n.atrib = podeFazer('atrib').pode && readSkills().pontosAtrib > 0; } catch { n.atrib = false; }
    // EQUIPAR: `n.equip` era `!!cfg.autoEquip` (idem, `true` eterno). Agora pergunta ao MESMO
    // `planoEquipar` que o planeador e o actor usam: só pede o passo quando há mesmo troca a fazer.
    try { n.equip = podeFazer('equip').pode && planoEquipar(bag).mexe; } catch { n.equip = false; }
    // REFINO: oportunidade com throttle (como `montar`/`comprar`) — senão nunca fica satisfeita.
    try { n.refino = podeFazer('refino').pode && (Date.now() - _ultimoRefino) > 1800000 && precisaRefino(); } catch { n.refino = false; }
    // ---- BUILD POR FASE: IR BUSCAR AO COFRE O QUE A BUILD DE AGORA TEM LÁ (PEDIDO DO DONO) ----
    // É necessidade PRIMÁRIA: uma peça da build parada no cofre vale uma viagem (não é
    // "oportunidade" como comprar/refinar). Só fica verdadeira quando a extensão JÁ SABE que a
    // peça está no cofre (última leitura guardada) — por isso existe a necessidade `lerCofre`.
    try { n.buscar = podeFazer('buildPorFase').pode && pecasDaFaseNoCofre(faseAtual()).length > 0; } catch { n.buscar = false; }
    // LER O COFRE: OPORTUNIDADE (não paga a viagem sozinha) e com throttle de 10 min. Sem isto
    // a extensão nunca sabe o que está guardado e o `buscar` nunca abre.
        // DEFEITO CORRIGIDO (medido 2026-10-14): o `lerCofre` NAO passava por `podeFazer` nem era
    // desligado quando nenhuma primaria esta aberta. Resultado observado ao vivo: com o
    // autoplay DESLIGADO ele continuava `true`, e era a UNICA necessidade aberta — logo o
    // `faltando` nunca fechava e o boneco voltava a base a cada 10 min para sempre (a MESMA
    // classe de bug que o `n.presente`/`n.tarefa`/`n.equip` eternos). Ler o cofre e uma accao
    // do ramo `cofre` (que tem a excepcao de Runeterra), e e OPORTUNIDADE: nao paga a viagem.
    // M2: enquanto NUNCA houve leitura do cofre, a estreia tem prioridade (para o painel ter
    // dados); depois volta a ser oportunidade de 10 min. Um `lerCofre` que falhe fica silenciado
    // pelo `estaIndisponivel` adiante, logo isto NAO reabre o ciclo de recall.
    // CADÊNCIA PRÓPRIA (`cfg.cofreCadenciaMin`, 10 min por omissão) em vez do 600000 fixo: a ida à
    // Fonte para ler o cofre é uma TAREFA PERIÓDICA (não um need eterno — isso já foi corrigido).
    try { n.lerCofre = podeFazer('cofre').pode && (!(_cofreCache && _cofreCache.length) || (Date.now() - _ultimoLerCofre) > numOr(cfg.cofreCadenciaMin, 10) * 60000); } catch { n.lerCofre = false; }
    n.mercado = n.anunciar;      // só vai ao mercado se houver lendário <A p/ anunciar
    // MONTAGEM AUTÓNOMA: no máximo 1x/30 min e só com ouro que sobre à reserva.
    n.montar = podeFazer('montar').pode && (Date.now() - _ultimaMontagem) > 1800000 && readGold() > 60000;
    // O comentário antigo dizia "checa barato e sai cedo" — MEDIDO: 13,5 s por
    // passagem (4 bases da build ideal, cada uma abre grupo e lê ofertas). A
    // rotina da base inteira chegava a 60–90 s por causa disto. Os preços do
    // mercado não mudam de segundo a segundo: no máximo 1 consulta a cada 10 min.
    n.comprar = (Date.now() - _ultimaCompra) > 600000;
    // ---- REGRA DE OURO: OPORTUNIDADES não pagam uma viagem sozinhas ----
    // Se NENHUMA necessidade primária está aberta, as oportunidades (mercado/comprar/refino/
    // montar) são DESLIGADAS nesta passagem: ele fica a farmar em vez de andar para trás e para
    // a frente. (Foi este o ciclo que o dono viu: ouro congelado em 52.300 durante minutos.)
    const haPrimaria = NECESSIDADES_PRIMARIAS.some((k) => n[k] === true);
    // A estreia do cofre (sem leitura nenhuma ainda) sobrevive a falta de primaria: e o que faz
    // o painel ter dados. Com leitura ja gravada, volta a ser oportunidade como as outras.
    if (!haPrimaria) { n.mercado = false; n.comprar = false; n.refino = false; n.montar = false; if (_cofreCache && _cofreCache.length) n.lerCofre = false; }
    n._custoIda = custo;
    // NECESSIDADES QUE FALHARAM ficam SILENCIOSAS (ver `marcarIndisponivel`): é isto que
    // impede o ciclo de recall quando a loja não tem o que ele pede.
    for (const k of Object.keys(n)) if (n[k] === true && estaIndisponivel(k)) n[k] = false;
    if (estaIndisponivel('anunciar')) n.mercado = false;
    return n;
  }
  /** PASSOS da base, na ORDEM DE PRIORIDADE, indexados pela NECESSIDADE que os pede.
   *  [necessidade, nome do passo, função]. Esta tabela é a ÚNICA definição da ordem:
   *  `acaoBase` e `supervisarBase` leem daqui, logo nunca podem discordar sobre o que
   *  "a base está completa" quer dizer. */
  const PASSOS_BASE = [
    ['presente', 'presentes', () => pegarPresentes()],
    ['cura', 'cura', () => curarBase()],
    ['vender', 'venda', () => venderBase()],
    ['repor', 'reposto', () => reporPocoes()],
    ['tarefa', 'tarefas', async () => {
      const st = tarefaEstado() || {};
      if (st.pronta) { const r = { entregou: await entregarTarefa() }; if (!(tarefaEstado() || {}).tem) r.nova = await aceitarTarefa(); return r; }
      return { diaria: await aceitarDiarias(), nova: await aceitarTarefa() };
    }],
    ['hab', 'habs', () => subirHabilidades()],
    ['atrib', 'atrib', () => distribuirAtributos()],
    ['equip', 'equip', () => equiparMelhores()],
    ['buscar', 'buscar no cofre', () => buscarPecasDaFase(faseAtual())],
    ['cofre', 'cofre', async () => {
      const bag = scanBag(true); const p = bag ? planBag(bag) : null;
      const cofre = p ? (p.acts || []).filter((a) => a.action === 'GUARDAR_COFRE') : [];
      if (!cofre.length) return { ok: true, itens: 0 };
      await abrirCofreTesoureira(); for (const a of cofre) await guardarNoCofre(a.it.id); fecharJanelas();
      return { ok: true, itens: cofre.length };
    }],
    ['lerCofre', 'ler cofre', () => { _ultimoLerCofre = Date.now(); return lerCofreBase(); }],
    ['mercado', 'mercado', () => anunciarLendarios()],
    ['comprar', 'comprar', () => { _ultimaCompra = Date.now(); return comprarNoMercado(); }],
    ['refino', 'refino', () => { _ultimoRefino = Date.now(); return refinarMelhores(); }],
    ['montar', 'montar', () => montarMelhorReceita()],
  ];
  const PASSOS_CHAVES = new Set(PASSOS_BASE.map((p) => p[0]));
  /** Necessidades PENDENTES que têm passo (a lista que decide "a base está completa?"). */
  function faltandoNaBase(n) {
    const x = n || necessidadesBase();
    return Object.keys(x).filter((k) => x[k] === true && PASSOS_CHAVES.has(k));
  }

  /** ROTINA DA BASE — REPETE até não faltar nada.
   *
   *  P0 do dono (verbatim): "a porra da base ainda nao RESPEITA as tarefas q tem q acontecer
   *  na base, e o boneco ja sai dela pra farmar. e ele ainda volta segundos depois pra fazer
   *  mais coisa."
   *
   *  AS 3 CAUSAS QUE ISTO CORRIGE (lidas no código, não aceites por terceiros):
   *   (1) `necessidadesBase()` era calculada UMA vez, no início. Uma necessidade que APARECIA
   *       durante a rotina (a mochila enche, uma tarefa fica pronta, cai lixo novo) nunca era
   *       tratada nessa passagem -> o boneco saía e voltava.
   *   (2) `res.ok` nascia `true` e NUNCA era posto a `false`: um passo que falhava ou dava
   *       timeout não mudava nada, e o `supervisarBase` via `ok:true` e mandava viajar.
   *   (3) o `finally` do `supervisarBase` viajava com `res.ok` sem re-verificar as necessidades.
   *
   *  AGORA: cada passagem RE-LÊ `necessidadesBase()` (até `BASE_MAX_PASSAGENS`, teto de
   *  segurança contra loop), cada passo registra `erro`/`timeout` e entra em `res.falhas`, e
   *  `res.ok` é decidido pela RE-LEITURA FINAL — `ok:true` só quando não sobra NADA pendente
   *  E nenhum passo falhou. `res.restou` diz exactamente o que faltou (o Lead e o dono vêem-no
   *  no log da GUI). */
  const BASE_MAX_PASSAGENS = 3;
  async function acaoBase() {
    if ((readLocation().text || '') !== 'Fonte') return { ok: false, motivo: 'nao esta na base' };
    if (pausado) return { ok: false, motivo: 'pausado' };
    if (baseLock && Date.now() - baseLockAt < BASE_LOCK_MS) return { ok: false, motivo: 'base ocupada (mutex)' };
    if (baseLock) logEvent('base', { mutex: 'expirado', presoMs: Date.now() - baseLockAt });   // auto-cura
    baseLock = true; baseLockAt = Date.now();
    marcarAtiva();
    const res = { ok: true, passagens: 0, ordem: [], falhas: [] };
    let inicio = [];      // necessidades abertas na 1.ª passagem (p/ medir o que FECHOU)
    const passo = async (nome, fn) => {
      res.ordem.push(nome);
      const t0 = Date.now();
      try {
        // TETO por passo: um passo que nao responde nao pode prender a rotina toda.
        res[nome] = await Promise.race([
          Promise.resolve().then(fn),
          new Promise((r) => setTimeout(() => r({ timeout: true, ms: PASSO_MS }), PASSO_MS)),
        ]);
        if (res[nome] && res[nome].timeout) logIssue('base:' + nome, { erro: 'timeout de passo', ms: PASSO_MS });
      } catch (e) { res[nome] = { erro: String(e) }; logIssue('base:' + nome, { erro: String(e) }); }
      res[nome + 'Ms'] = Date.now() - t0;
      // CAUSA (2): um passo que falhou TEM de aparecer. Antes `res.ok` ficava `true` à mesma.
      if (passoFalhou(res[nome])) { res.falhas.push(nome); res.ok = false; }
      await humano(300, 800);
    };
    try {
      for (let p = 1; p <= BASE_MAX_PASSAGENS; p++) {
        await humano(250, 650);
        const n = necessidadesBase();          // RE-AVALIADO a cada passagem (CAUSA 1)
        res.passagens = p;
        res.necessidades = n;
        const fila = PASSOS_BASE.filter((x) => n[x[0]] === true);
        if (p === 1) inicio = fila.map((x) => x[0]);
        if (!fila.length) break;               // nada a fazer: sai já, sem passagem extra
        for (const x of fila) res.ordem.push(x[1]);
        for (const x of fila) await passo(x[1], x[2]);
      }
      // CAUSA (2)/(3): o veredicto é a RE-LEITURA, não a esperança do código.
      const fim = necessidadesBase();
      res.restou = faltandoNaBase(fim);
      res.fechou = Math.max(0, inicio.length - res.restou.length);   // quantas necessidades FECHARAM
      res.ok = res.restou.length === 0 && res.falhas.length === 0;
      // O que NÃO fechou fica indisponível por INDISPONIVEL_MS (deixa de ser pedido); o que
      // fechou volta a ser pedível quando aparecer outra vez. Sem isto, qualquer coisa que a
      // loja não vende (ex.: Poção Suprema abaixo do nível 30) vira ping-pong eterno.
      const aindaAbertas = new Set(res.restou);
      for (const k of res.restou) marcarIndisponivel(k, 'a base não conseguiu fechar esta necessidade' + (res.falhas.length ? ' (passos: ' + res.falhas.join(',') + ')' : ''));
      for (const k of inicio) if (!aindaAbertas.has(k)) limparIndisponivel(k);
      if (!res.ok) res.motivo = 'base incompleta: ' + (res.restou.length ? res.restou.join(',') : 'passos falhados (' + res.falhas.join(',') + ')');
      logEvent('base', res);
      marcarAtiva();
    } finally { baseLock = false; baseLockAt = 0; }
    return res;
  }

  // ------------------------------------------------------------- mercado (J)
  function mercadoEl(abrir) { const m = q1('#janela-mercado'); if (m && m.hidden && abrir) press('j'); return m; }
  /** Lista minhas ofertas (aba Minhas ofertas): [{ id, nome, raridade, qual, preco, txt }]. */
  async function lerMinhasOfertas() {
    const m = mercadoEl(true); if (!m) return null;
    if (m.hidden) { press('j'); await esperar(500); }
    m.querySelector('[data-aba="minhas"]')?.click();
    await esperar(450);
    return [...m.querySelectorAll('[data-cancelar]')].map((b) => {
      const card = b.closest('article,li,div');
      const txt = (card?.textContent || '').replace(/\s+/g, ' ').trim();
      const mq = txt.match(/\[([A-Z]{1,2})\]/);
      const pr = txt.match(/([\d.,]+\s*[kKmM]?)\s*ouro/i);
      return { id: b.dataset.cancelar, nome: txt.split('[')[0].trim(), raridade: /lend/.test(txt) ? 'lendario' : /pic/.test(txt) ? 'epico' : 'basico', qual: mq ? mq[1] : null, preco: pr ? parseBig(pr[1]) : null, txt: txt.slice(0, 120) };
    });
  }
  /** Cancela uma oferta pelo id. */
  function cancelarOferta(id) { const b = q1(`#janela-mercado [data-cancelar="${id}"]`); if (b) { if (Array.isArray(_ofertasCache)) _ofertasCache = _ofertasCache.filter((o) => String(o.id) !== String(id)); b.click(); logEvent('mercado', { acao: 'cancelar', id }); return true; } return false; }
  /** Anuncia o item de índice `i` (aba Vender) por `preco`. */
  async function anunciarItem(i, preco) {
    const m = mercadoEl(true); if (!m) return { ok: false, motivo: 'sem mercado' };
    m.querySelector('[data-aba="vender"]')?.click();
    await esperar(200);
    const b = [...m.querySelectorAll('[data-escolher]')][i];
    if (!b) return { ok: false, motivo: 'sem item no índice ' + i };
    const src = b.querySelector('img')?.getAttribute('src') || '';
    const alt = String(b.getAttribute?.('data-id') || b.dataset?.escolher || b.dataset?.id || '');
    const baseCandidato = (src.match(/\/(\d+)\./) || alt.match(/(\d+)/) || [])[1] || null;
    if (baseCandidato && ehLendarioDaBuild(baseCandidato)) return { ok: false, motivo: 'lendario da build da classe — nao anuncia' };
    // PRIORIDADE EXTREMA (3031/3089, automation.js:47): o mercado também não toca neles — nem duplicados.
    if (baseCandidato && ehPrioridadeExtrema(baseCandidato)) { const e = prioExtremaDe(baseCandidato); return { ok: false, motivo: `PRIORIDADE EXTREMA (${e.motivo}) — nao anuncia [${e.fonte}]` }; }
    if (!baseCandidato) return { ok: false, motivo: 'slot sem id legivel — nao anuncia sem identificar o item' };
    b.click();
    await esperar(200);
    const inp = m.querySelector('#vender-preco');
    if (inp && preco) { inp.value = preco; inp.dispatchEvent(new Event('input', { bubbles: true })); }
    const an = m.querySelector('[data-anunciar]');
    if (!an) return { ok: false, motivo: 'sem botão anunciar' };
    an.click();
    logEvent('mercado', { acao: 'anunciar', indice: i, preco: preco || null });
    return { ok: true, preco: preco || null };
  }
  function fecharMercado() { q1('#janela-mercado [data-fechar]')?.click(); }

  // --------------------------------------------- cofre da Tesoureira (DOM, sem clique na tela)
  const QL = ['C', 'B', 'A', 'S', 'SS'];
  const qDe = (q) => Math.max(0, QL.indexOf((q || 'C').toUpperCase()));
  /** Lê os slots do cofre ABERTO: [{ nome, base, qual, refino, qtd, acao }]. */
  function lerCofreSlots() {
    return [...document.querySelectorAll('.cofre-slot[data-k]')].map((s) => {
      const txt = (s.dataset.nome || s.title || '').trim();
      const m = txt.match(/^(.*?)\s*(?:\+(\d+))?\s*(?:\[([A-Za-z]{1,2})\])?\s*(?:×(\d+))?\s*$/);
      const img = s.querySelector('img');
      const base = (img?.getAttribute('src') || '').match(/\/(\d+)\.png/)?.[1] || (String(s.dataset.k || '').match(/\d+/) || [])[0] || null;
      // M1 (pedido do subagent da GUI): a chave do SLOT (`data-k`) nao era devolvida, logo a
      // GUI so conseguia mostrar a posicao (#N). O `salvarCofre` grava este objecto tal e qual,
      // por isso o slot passa a ficar persistido e a GUI (que ja le i.k||i.slot||i.slotId) mostra-o.
      return { k: s.dataset.k || null, nome: (m ? m[1] : txt).trim(), base, refino: (m && m[2]) ? +m[2] : 0, qual: (m && m[3]) ? m[3].toUpperCase() : null, qtd: (m && m[4]) ? +m[4] : 1, acao: s.dataset.cofre || null };
    });
  }
  /** Salva o cofre no storage (a extensão fica sabendo o que o dono tem guardado). */
  function salvarCofre() {
    const itens = lerCofreSlots().filter((i) => i.acao === 'retirar' || i.acao === 'sacar');   // só o que está NO cofre
    _cofreCache = itens;                      // memória viva: as 4 fontes passam a saber o que está guardado
    _cofreAt = Date.now();                    // M3: instante da leitura, para a GUI dizer "lido há X"
    try { chrome.storage.local.set({ [STORAGE_KEY + ':cofre']: { at: Date.now(), itens } }); } catch { /* ignore */ }
    logEvent('cofre', { itens: itens.length });
    return itens;
  }
  /** Melhor item do cofre por nome/base: maior QUALIDADE, depois maior REFINO. */
  function melhorDoCofre(alvo) {
    const a = String(alvo).toLowerCase();
    const cand = lerCofreSlots().filter((i) => (i.acao === 'retirar' || i.acao === 'sacar') && (String(i.base) === String(alvo) || (i.nome || '').toLowerCase().includes(a)));
    if (!cand.length) return null;
    cand.sort((x, y) => (qDe(y.qual) - qDe(x.qual)) || (y.refino - x.refino));
    return cand[0];
  }
  /** Deposita no cofre (ABERTO) um item da mochila — épico S/SS não fica na mochila. */
  async function guardarNoCofre(alvo) {
    const base = baseDe(alvo);
    const slot = [...document.querySelectorAll('.cofre-slot[data-k]')].find((s) => s.dataset.cofre === 'guardar' && (String(s.dataset.k || '').includes(base) || (s.querySelector('img')?.getAttribute('src') || '').includes('/' + base + '.png')));
    if (!slot) return { ok: false, motivo: 'sem slot guardar de ' + base };
    slot.click(); await humano(380);
    logEvent('cofre', { guardou: base });
    return { ok: true, base };
  }
  /** Aceita a tarefa do Capitão da Legião (na Fonte) mais vantajosa e fazível.
   *  Fluxo: NPC → `[data-palavra="tarefa"]` → `#npc-troca .troca-linha [data-tarefa=k]`. */
  async function aceitarTarefa() {
    if (!naBase()) return { ok: false, motivo: 'so na Fonte' };
    fecharJanelas(); await humano(250);
    if (!clickNPC('Capitão da Legião')) return { ok: false, motivo: 'sem capitao' };
    const btn = await waitFor('#janela-npc [data-palavra="tarefa"]', 4000);
    if (!btn) return { ok: false, motivo: 'sem opcao tarefa' };
    btn.click(); await humano(350);
    if (!(await waitFor('#npc-troca [data-tarefa]', 4000))) return { ok: false, motivo: 'sem tarefas' };
    const rows = qa1('#npc-troca .troca-linha');
    const ofertas = rows.map((row) => {
      const txt = (row.textContent || '').replace(/\s+/g, ' ');
      const b = row.querySelector('[data-tarefa]');
      const min = +((txt.match(/~?\s*([\d.]+)\s*min/i) || [])[1] || 0);
      const xp = parseBig((txt.match(/([\d.,]+\s*[kKmM]?)\s*de XP/i) || [])[1]);
      const ouro = parseBig((txt.match(/([\d.,]+\s*[kKmM]?)\s*de ouro/i) || [])[1]);
      const garant = /item garantido/i.test(txt); const podeItem = /pode dar item/i.test(txt);
      const tipo = (String(row.className).match(/tarefa-(\w+)/) || [])[1] || '';
      const itemBonus = garant ? 600 : (podeItem ? 150 : 0);
      const score = min > 0 ? (xp + 2 * ouro) / min + itemBonus / Math.max(1, min) : (xp + 2 * ouro);
      return { row, k: b ? b.dataset.tarefa : null, min, xp, ouro, garant, podeItem, tipo, score, txt };
    }).filter((o) => o.k != null);
    if (!ofertas.length) return { ok: false, motivo: 'sem ofertas' };
    for (const o of ofertas) if (o.tipo === 'desafio') o.score *= 0.6;   // zona de cima: penaliza
    ofertas.sort((a, b) => b.score - a.score);
    const best = ofertas[0];
    best.row.querySelector('[data-tarefa]').click(); await humano(450);
    logEvent('tarefa', { aceitou: best.tipo, min: best.min, xp: best.xp, ouro: best.ouro, item: best.garant ? 'garantido' : (best.podeItem ? 'chance' : null) });
    fecharJanelas();
    return { ok: true, tipo: best.tipo, min: best.min, xp: best.xp, ouro: best.ouro, item: best.garant ? 'garantido' : (best.podeItem ? 'chance' : null), todas: ofertas.map((o) => ({ tipo: o.tipo, min: o.min, xp: o.xp, ouro: o.ouro, score: Math.round(o.score) })) };
  }

  /** Estado da tarefa lido do rastreio do jogo (`#rastreio-tarefa`). */
  function tarefaEstado() {
    const bt = document.querySelector('#rastreio-tarefa');
    if (!bt || bt.hidden) return { tem: false, pronta: false };
    return { tem: true, pronta: bt.classList.contains('pronta'), texto: (bt.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 140) };
  }

  /** MODELO de atributos POR CAMPEÃO — derivado da dica do MOTOR (`DICA_ATRIBUTOS`,
   *  motor.js:474-482) cruzada com a CLASSE e o PERFIL do campeão (motor.js:484 `MODELOS`):
   *   - TANQUE  -> 'tanque'      { vitalidade:2, resistencia:2, forca:1 }  (motor.js:485)
   *   - MAGO/AP -> 'conjurador'  { foco:2, forca:2, vitalidade:1 }         (motor.js:488)
   *   - ATIRADOR/dano -> 'dano'  { forca:3, agilidade:2, vitalidade:1 }    (motor.js:487)
   *  REGRA DO DONO para o Yasuo: "Yasuo AD: Força primeiro" — o modelo 'dano' tem `forca` com o
   *  MAIOR peso (3) e a dica do motor diz o mesmo (motor.js:481: "Força e Agilidade dão dano e
   *  velocidade de ataque (que também acelera a Tempestade de Aço)"). O `equilibrado` que
   *  estava por omissão punha `forca` e `vitalidade` com o MESMO peso 2 — não era o pedido. */
  function modeloAtribDe(c) {
    c = c || META.champAtual || null;
    const perfil = perfilDe(c);
    if (perfil === 'tanque') return 'tanque';
    if (c && c.magia) return 'conjurador';
    return 'dano';                    // dano e atirador
  }
  /** Distribui TODOS os pontos de atributo livres seguindo o MODELO do motor (pesos).
   *  Mesma fórmula do jogo: cada ponto vai ao atributo mais "atrasado" vs. o peso
   *  (motor.js:2853-2865 `distribuirAtributos`, incluindo o `+1` na soma — motor.js:2859).
   *  ANTI-LOOP (bug medido): o laço clicava até 600 vezes SEM confirmar que o valor mudou; com
   *  0 pontos livres ele ficava a clicar num botão que não faz nada e dizia `gastos:600`. Agora
   *  compara a SOMA dos valores lidos do DOM antes/depois de cada clique e para quando não muda. */
  async function distribuirAtributos(modelo) {
    const tab = q1('[data-aba="atributos"]');
    if (tab && !tab.classList.contains('ativa')) { tab.click(); await humano(300); }
    const MOD = META.modelos || null;
    const chave = modelo || cfg.modeloAtrib || modeloAtribDe(META.champAtual);
    const pesos = (MOD && MOD[chave] && MOD[chave].pesos) || { forca: 3, agilidade: 2, vitalidade: 1 };
    const total = Object.values(pesos).reduce((s, p) => s + p, 0) || 1;
    const lerValores = () => { const o = {}; for (const b of [...document.querySelectorAll('#atributos [data-atrib]')]) o[b.dataset.atrib] = +(document.querySelector(`[data-valor="${b.dataset.atrib}"]`)?.textContent || 0); return o; };
    const somaDe = (o) => Object.values(o).reduce((s, v) => s + v, 0);
    let gastos = 0, paradas = 0;
    for (let i = 0; i < 600; i++) {
      const btns = [...document.querySelectorAll('#atributos [data-atrib]')].filter((b) => !b.disabled);
      if (!btns.length) break;                                  // sem pontos livres
      const cur = lerValores();
      const soma = somaDe(cur) + 1;
      const ka = Object.keys(pesos).sort((x, y) => ((cur[x] || 0) - (soma * pesos[x]) / total) - ((cur[y] || 0) - (soma * pesos[y]) / total))[0];
      const b = btns.find((x) => x.dataset.atrib === ka);
      if (!b) break;
      const antes = somaDe(cur);
      b.click();
      await esperar(25);
      const depois = somaDe(lerValores());
      if (depois > antes) { gastos++; paradas = 0; } else { paradas++; if (paradas >= 3) break; }   // 3 cliques sem efeito = não há pontos
      if (gastos && gastos % 5 === 0) await humano(40, 90);
    }
    logEvent('atributos', { modelo: chave, gastos });
    return { ok: gastos > 0, modelo: chave, gastos };
  }

  /** Entrega a tarefa PRONTA ao Capitão (na Fonte). Fluxo: NPC → `[data-palavra="entregar"]` → `sim`. */
  async function entregarTarefa() {
    if (!naBase()) return { ok: false, motivo: 'so na Fonte' };
    const st = tarefaEstado();
    if (!st.tem) return { ok: false, motivo: 'sem tarefa' };
    if (!st.pronta) return { ok: false, motivo: 'tarefa incompleta', texto: st.texto };
    fecharJanelas(); await humano(250);
    if (!clickNPC('Capitão da Legião')) return { ok: false, motivo: 'sem capitao' };
    const btn = await waitFor('#janela-npc [data-palavra="entregar"]', 4000);
    if (!btn) return { ok: false, motivo: 'sem opcao entregar' };
    btn.click(); await humano(400);
    const sim = document.querySelector('#janela-npc [data-palavra="sim"]');
    if (sim) { sim.click(); await humano(300); }
    logEvent('tarefa', { entregou: true, texto: st.texto });
    return { ok: true, entregou: true, tinha: st.texto };
  }

  /** Recebe as diárias prontas e aceita as disponíveis no Capitão (na Fonte).
   *  Fluxo: NPC → `[data-palavra="diaria"]` → o jogo premia as prontas e mostra as aceitáveis. */
  async function aceitarDiarias() {
    if (!naBase()) return { ok: false, motivo: 'so na Fonte' };
    fecharJanelas(); await humano(250);
    if (!clickNPC('Capitão da Legião')) return { ok: false, motivo: 'sem capitao' };
    const btn = await waitFor('#janela-npc [data-palavra="diaria"]', 4000);
    if (!btn) return { ok: false, motivo: 'sem opcao diaria' };
    btn.click(); await humano(450);
    const btns = [...document.querySelectorAll('[data-aceitar-diaria]')].filter((b) => !b.disabled);
    const ks = btns.map((b) => b.dataset.aceitarDiaria);
    for (const b of btns) { b.click(); await humano(450); }
    logEvent('diaria', { aceitou: ks });
    fecharJanelas();
    return { ok: true, aceitou: ks, quantas: ks.length };
  }

  /** Retira do cofre (ABERTO) o melhor item por nome/base. */
  async function retirarDoCofre(alvo) {
    const b = melhorDoCofre(alvo);
    if (!b) return { ok: false, motivo: 'sem ' + alvo + ' no cofre' };
    const slot = [...document.querySelectorAll('.cofre-slot[data-k]')].find((s) => (s.dataset.nome || '').trim() === `${b.nome}${b.refino ? ' +' + b.refino : ''}${b.qual ? ' [' + b.qual + ']' : ''}` || (s.querySelector('img')?.getAttribute('src') || '').includes('/' + b.base + '.'));
    if (!slot) return { ok: false, motivo: 'slot nao achado' };
    slot.click(); await humano(380);
    logEvent('cofre', { retirou: b.nome, qual: b.qual, refino: b.refino });
    return { ok: true, ...b };
  }
  const lerCofre = () => lerCofreSlots();

  /** Os NPCs que abrem o cofre: a Tesoureira (Fonte) e o Burrinho de Carga (cidade) — motor.js `podeCofre`. */
  const NPCS_DO_COFRE = ['Tesoureira de Piltover', 'Burrinho de Carga'];
  /** Há NPC do cofre em `#npcs` AGORA? (só olha; quem clica é o `clicarNpcDoCofre`) */
  const npcCofreNoDom = () => NPCS_DO_COFRE.some((n) => !!q1(`#npcs button[data-npc="${n}"]`));
  /** Clica no NPC do cofre que estiver em `#npcs` e devolve o nome dele (ou null). */
  function clicarNpcDoCofre() { for (const n of NPCS_DO_COFRE) if (clickNPC(n)) return n; return null; }
  /** Espera o NPC do cofre aparecer em `#npcs` — a lista vem do servidor, chega uns ms depois de andar.
   *  O tecto e em TENTATIVAS (nao em relogio): 12 x 180 ms ~ 2,2 s no jogo e INSTANTANEO no banco de
   *  testes (o stub resolve os setTimeout em microtask), para o banco nao esperar 2 s por assercao. */
  async function esperarNpcDoCofre(tentativas = 12, passo = 180) {
    for (let i = 0; i < tentativas; i++) {
      const via = clicarNpcDoCofre();
      if (via) return via;
      await esperar(passo);
    }
    return null;
  }

  /** Abre o cofre da Tesoureira de Piltover (Fonte) ou do Burrinho de Carga (cidade) via DOM.
   *  Fluxo do jogo: `#npcs [data-npc]` → diálogo `#janela-npc [data-palavra="cofre"]` → grade `.cofre-slot`.
   *  (O cofre abre na Fonte e nas cidades de Runeterra — motor.js `podeCofre`.)
   *
   *  DEFEITO MEDIDO AO VIVO (2026-10-14, Katarina na Fonte): `#npcs` tinha Soraka, Lojista, Mestre da
   *  Legião, Capitão da Legião e Ornn — a TESOUREIRA NÃO ESTAVA LÁ — e o cofre devolvia sempre o motivo
   *  genérico "sem Tesoureira/Burrinho aqui", em sítio nenhum. Causa (dono, verbatim): "por que tem que
   *  clicar pra cima, a partir da fonte, duas vezes (andar pra cima) e achar a tesoureira". Confere com
   *  o fonte do jogo: a Tesoureira não está na praça, está ACIMA dela (`mundo.js:19-21` NPCS_FONTE, em
   *  `CY - 5`) e só entra em `#npcs` depois de o boneco subir. O código antigo procurava o NPC PARADO
   *  onde o boneco estava. Agora, na FONTE e sem a Tesoureira no DOM, ele ANDA 2 TILES PARA CIMA
   *  (clique no chão do canvas — ver o bloco "ANDAR NO CHÃO") e só depois procura o NPC. */
  // A TESOUREIRA ESTA A 5 TILES ACIMA DO CENTRO DA PRACA: `mundo.js:20` NPCS_FONTE da-lhe
  // `y: CY - 5` (e `mundo.js:131`: "acima da fonte: o cofre de ferro e o barril da Tesoureira").
  // O boneco chega a Fonte no CENTRO (CY), logo 4 tiles (o antigo 2+2) ficavam UM TILE AQUEM e o
  // NPC nunca entrava em `#npcs` — defeito relatado pelo dono, verbatim: "subi 4 tiles na Fonte e a
  // Tesoureira nao apareceu em #npcs" / "e pra andar la em cima do canvas, duas vezes".
  // 6 tiles = CY-5 com 1 de margem; o `opts.ate` verifica o `#npcs` DEPOIS DE CADA TILE, logo para
  // assim que a Tesoureira aparece (tipicamente no 5.º) e nunca anda mais do que o preciso.
  const COFRE_TILES_ACIMA = 6;
  const COFRE_TENTATIVAS_SUBIDA = 2;  // o "duas vezes" do dono: 1.ª passagem e, se algo a interromper, 2.ª
  async function abrirCofreTesoureira() {
    if (document.querySelector('.cofre-slot[data-k]')) return { ok: true, ja: true };
    fecharJanelas(); await humano(250);
    let via = clicarNpcDoCofre();
    let subiu = 0, motivoSubida = null;
    for (let t = 0; !via && t < COFRE_TENTATIVAS_SUBIDA; t++) {
      if (!naBase()) break;      // CIDADE: o Burrinho está onde o boneco está — não se anda às cegas (caso antigo intacto)
      const sub = await subirNaFonte(COFRE_TILES_ACIMA, { ate: npcCofreNoDom });
      if (!sub.ok) { motivoSubida = sub.motivo || 'nao consegui andar no chao'; break; }
      subiu += sub.tiles || 0;
      via = await esperarNpcDoCofre();       // procura o NPC SÓ DEPOIS de subir (12 x 180 ms ~ 2,2 s)
    }
    if (!via) {
      // MOTIVO VERDADEIRO (antes era sempre o genérico, que escondia a causa real na Fonte)
      return { ok: false, motivo: subiu
        ? `subi ${subiu} tiles na Fonte e a Tesoureira nao apareceu em #npcs`
        : (motivoSubida ? 'nao cheguei a Tesoureira: ' + motivoSubida : 'sem Tesoureira/Burrinho aqui (cofre abre na Fonte ou na cidade)') };
    }
    const btn = await waitFor('#janela-npc [data-palavra="cofre"]', 5000);
    if (!btn) return { ok: false, motivo: 'sem opcao cofre' };
    btn.click();
    const grid = await waitFor('.cofre-slot[data-k]', 3000);
    const slots = grid ? document.querySelectorAll('.cofre-slot[data-k]').length : 0;
    logEvent('cofre', { abriu: !!grid, via, slots, subiu });
    return { ok: !!grid, via, slots, subiu };
  }

  // --------------------------------------------- equipar / desequipar (DOM, sem clique na tela)
  const baseDe = (id) => String(id || '').split('~')[0].split('+')[0];
  const q1a = (s) => [...document.querySelectorAll(s)];
  /** id do slot -> { base, refino, qual, mult }. Aceita as DUAS ordens: o jogo escreve
   *  '<base>+<refino>~<qual>' (scanBag) e o dono escreve '<base>~<qual>+<refino>'.
   *  `mult` = (1 + BONUS_REFINO*refino) * QUALIDADES[qual].mult (motor.js:252; BONUS_REFINO motor.js:55)
   *  — é o multiplicador que o motor aplica a TODOS os stats (motor.js:252-255, cdr incluído).
   *  Um id CRU (sem ~QUAL) é NEUTRO: qualidade B, refino 0, `mult` 1 — não se inventa qualidade.
   *  É o ÚNICO sítio que interpreta esta sintaxe: `statsSet` e `efeitosEquipados` usam-no (era aqui
   *  que o `scoreSet` perdia as peças: o `statsSet` casava o id por IGUALDADE EXACTA, logo
   *  '3175~A' não existia no catálogo e a peça contribuía ZERO — MEDIDO: as duas botas davam o
   *  mesmo score). */
  const parseSlotId = (id) => {
    const s = String(id || '');
    const m = s.match(/^(\d+)(?:\+(\d+))?(?:~([A-Za-z]+))?/);
    const temQual = /~[A-Za-z]/.test(s);
    const qual = temQual ? ((s.match(/~([A-Za-z]+)/) || [])[1] || 'B').toUpperCase() : 'B';
    const refino = +(((s.match(/\+(\d+)/) || [])[1]) || 0);
    return { base: m ? m[1] : null, refino, qual, mult: (1 + BONUS_REFINO * refino) * (QUAL_MULT[qual] || 1) };
  };
  /** MELHOR instância de um base dentro de `seletor`: maior QUALIDADE, depois maior REFINO.
   *  Ex.: se há Cajado do Vazio B e A na mochila, escolhe o A (e o de maior refino entre iguais). */
  const melhorSlot = (seletor, base) => {
    const cand = q1a(seletor).filter((s) => baseDe(s.getAttribute('data-id')) === String(base));
    if (!cand.length) return null;
    cand.sort((a, b) => { const A = parseSlotId(a.getAttribute('data-id')), B = parseSlotId(b.getAttribute('data-id')); return (qIdx(B.qual) - qIdx(A.qual)) || (B.refino - A.refino); });
    return cand[0];
  };
  /** Equipa um item da MOCHILA pelo id-base (ex.: '3100') — sempre a MELHOR instância. */
  async function equiparItem(base) {
    const win = q1('#janela-bolsa'); if (!win) return { ok: false, motivo: 'sem bolsa' };
    const euAbri = win.hidden;
    if (euAbri) { press('i'); await esperar(350); }
    const b = melhorSlot('#mochila button.slot[data-id]', base);
    if (b) { b.click(); await humano(380); _bagCache = null; }
    if (euAbri && !win.hidden) press('i');
    if (!b) return { ok: false, motivo: 'sem ' + base + ' na mochila' };
    return { ok: true, base };
  }
  /** Desequipa o item equipado de um espaço (pelo id-base) — devolve pra mochila. */
  async function desequiparItem(base) {
    const b = q1a('#equip button.slot[data-id]').find((s) => baseDe(s.getAttribute('data-id')) === String(base));
    if (!b) return { ok: false, motivo: 'nao equipado: ' + base };
    b.click(); await humano(380); _bagCache = null;
    return { ok: true, base };
  }
  /** Aplica um conjunto de itens (por id-base): tira o que não está no set, equipa o que falta
   *  e SEMPRE garante a MELHOR instância (maior qualidade, depois maior refino) de cada base. */
  async function aplicarItens(ids) {
    const win = q1('#janela-bolsa');
    const euAbri = win && win.hidden;
    if (euAbri) { press('i'); await esperar(300); }
    const alvo = new Set(ids.map(String));
    for (const b of readEquip().map((e) => e.base)) if (!alvo.has(b)) await desequiparItem(b);
    for (const b of alvo) if (!readEquip().some((e) => e.base === b)) await equiparItem(b);
    // MELHOR INSTÂNCIA: se a equipada é pior que a melhor da mochila, troca.
    for (const b of alvo) {
      const eq = readEquip().find((e) => e.base === b);
      const bag = melhorSlot('#mochila button.slot[data-id]', b);
      if (!bag) continue;
      const bi = parseSlotId(bag.getAttribute('data-id'));
      const ei = eq ? parseSlotId(eq.id) : { qual: 'C', refino: -1 };
      if (qIdx(bi.qual) > qIdx(ei.qual) || (qIdx(bi.qual) === qIdx(ei.qual) && bi.refino > ei.refino)) {
        await desequiparItem(b); await equiparItem(b);
      }
    }
    if (euAbri && win && !win.hidden) press('i');
    return { ok: true, equipado: readEquip().map((e) => ({ base: e.base, id: e.id })) };
  }

  let equipBusy = false, equipAt = 0;
  /** ACTOR DO EQUIPAMENTO — "Equipar SEMPRE o melhor item disponível em cada slot" (regra do dono).
   *  A DECISÃO É TODA DO `alvoEquip()`: a MESMA função que o planeador usa para marcar EQUIPAR.
   *  (Antes havia aqui uma SEGUNDA cópia da regra — sem termo de raridade e com histerese de 5%
   *  fixa — e era por isso que planeador e actor podiam discordar: o Tiamat entrava no alvo mas a
   *  troca de 2,62% era recusada e o épico ficava preso na mochila. docs/itens-ideal.md §4.2/D10/D16.)
   *  Diferença para `aplicarItens`: aquele aplica um CONJUNTO de bases por contexto (mob × chefe,
   *  `cfg.trocaItens`); este garante o MELHOR disponível e a melhor INSTÂNCIA de cada base. */
  async function equiparMelhores() {
    const win = q1('#janela-bolsa');
    let abri = false;
    if (!document.querySelector('#mochila button.slot[data-id]') && (!win || win.hidden)) { press('i'); abri = true; await esperar(350); }
    const trocas = [];
    // A decisão é TODA do `alvoEquip()` — a MESMA função que o planeador usa para marcar EQUIPAR.
    let r = null;
    try { r = alvoEquip(scanBag()); } catch { r = null; }
    if (!r) { if (abri && win && !win.hidden) press('i'); return { ok: false, motivo: 'sem alvo de equipamento' }; }
    const ganhoPct = r.pAtual > 0 ? Math.round((r.pAlvo / r.pAtual - 1) * 100) : null;
    // TROCAS DE INSTÂNCIA (mesmo base): sempre estritamente melhor (maior qualidade → maior
    // refino). O motor aplica os dois como MULTIPLICADOR dos stats (motor.js:252/2898).
    const inst = [];
    for (const e of r.atual) {
      const b = melhorSlot('#mochila button.slot[data-id]', e.base);
      if (!b) continue;
      const bi = parseSlotId(b.getAttribute('data-id')), ei = parseSlotId(e.id);
      if (qIdx(bi.qual) > qIdx(ei.qual) || (qIdx(bi.qual) === qIdx(ei.qual) && bi.refino > ei.refino)) inst.push({ acao: 'trocar', base: e.base, id: b.getAttribute('data-id') });
    }
    if (!r.mexe) {
      // Sem troca de raridade, sem item especial e sem ganho ≥ histerese: NÃO mexe no conjunto
      // (é isto que impede a oscilação a cada tick) — mas a melhor instância é sempre aplicada.
      for (const t of inst) { await desequiparItem(t.base); await equiparItem(t.base); }
      if (abri && win && !win.hidden) press('i');
      if (inst.length) logEvent('equip', { trocas: inst, histerese: true, ganhoPct });
      return { ok: true, trocas: inst, ganhoPct, motivo: 'alvo ≈ atual (sem ganho ≥ ' + r.histerese + ' e sem troca de raridade/especial)' };
    }
    // (1) TIRA o que sai — liberta o espaço no ESTADO antes de pôr (motor.js:2870 `equipar`
    //     recusa quando já há 4 itens fora a bota: motor.js:2878).
    for (const e of r.saem) trocas.push({ acao: 'tirar', base: e.base, id: e.id });
    // (2) PÕE o que falta (garante a BOTA e o conjunto 1+4).
    for (const i of r.entram) trocas.push({ acao: 'por', base: i.base, id: i.id });
    // (3) MESMO base: troca por instância MELHOR (qualidade → refino).
    for (const t of inst) if (!trocas.some((x) => x.base === t.base && x.acao === 'por')) trocas.push(t);
    // aplica TIRANDO primeiro (esvazia slot), depois PONDO
    for (const t of trocas.filter((x) => x.acao === 'tirar')) await desequiparItem(t.base);
    for (const t of trocas.filter((x) => x.acao !== 'tirar')) { if (t.acao === 'por') await equiparItem(t.base); else { await desequiparItem(t.base); await equiparItem(t.base); } }
    if (abri && win && !win.hidden) press('i');
    if (trocas.length) logEvent('equip', { trocas, ganhoPct, raridade: r.trocaRaridade, especial: r.trocaEspecial, faltaSlot: r.faltaSlot });
    return { ok: true, trocas, ganhoPct, raridade: r.trocaRaridade, especial: r.trocaEspecial };
  }
  /** Roda no loop: se houver instância melhor de algo equipado, equipa (throttle 10 s). */
  async function checarEquipMelhor() {
    // DEFEITO CORRIGIDO (medido ao vivo 2026-10-14): este portao perguntava ao `cfg.enabled`
    // directamente, ignorando a HIERARQUIA. Com o auto-play desligado na Katarina, o item melhor
    // ficava na mochila para sempre (`mexe:true, entram:['3171']` medido, nunca aplicado).
    // Equipar e MANUTENCAO, nao auto-play: obedece ao interruptor `equip`.
    if (!podeFazer('equip').pode || equipBusy || pausado) return;   // equipar = MANUTENCAO
    if (Date.now() - equipAt < 60000) return;   // cooldown 60 s (não fica mexendo nos itens)
    if (!q1('#equip button.slot[data-id]')) return;
    equipAt = Date.now(); equipBusy = true;
    try { await equiparMelhores(); } catch { /* ignore */ } finally { equipBusy = false; }
  }

  // --------------------------------------------- ofertas do mercado (persistir)
  const OFERTAS_KEY = STORAGE_KEY + ':ofertas';
  /** Lê Minhas ofertas e persiste (a extensão passa a saber o que está anunciado). */
  let _ofertasCache = null;   // cache em memória: `mercadoSaturado()` é chamado SINCRONO (planBag decide
                              // anunciar-vs-vender), e antes NÃO tinha como ler — dava sempre "não saturado".
  async function salvarOfertas() {
    try {
      const o = await lerMinhasOfertas();
      if (o) { _ofertasCache = o; chrome.storage.local.set({ [OFERTAS_KEY]: { at: Date.now(), ofertas: o } }); logEvent('ofertas', { n: o.length }); }
      return o;
    } catch { return null; }
  }
  function lerOfertasSalvas() { return Array.isArray(_ofertasCache) ? _ofertasCache.slice() : null; }
  function ofertasEmCache(cb) {
    const done = typeof cb === 'function' ? cb : null;
    if (done) { try { chrome.storage.local.get(OFERTAS_KEY, (r) => done(r?.[OFERTAS_KEY]?.ofertas || [])); } catch { done([]); } return _ofertasCache; }
    try { chrome.storage.local.get(OFERTAS_KEY, (r) => { _ofertasCache = r?.[OFERTAS_KEY]?.ofertas || []; }); } catch { /* ignore */ }
    return _ofertasCache || [];
  }

  // --------------------------------------------- TESTAR CONJUNTOS (estado por passos)
  /** Estimativa de DPS de um CONJUNTO vs um alvo — inclui as passivas do motor
   *  (Rabadon +35%AP, Cajado pen 40%, Ímpeto CDR, Chama +20% <40%, Lich +75%AP/skill,
   *  Liandry queima 1,5% da vida máx/s com teto de 3× a curva). */
  /** Stats de item compartilhadas (AP, CDR, pen, passivas) — uma fonte só p/ estimarSet/scoreSet. */
  function statsSet(ids, opt) {
    const qm = (opt && opt.mult) || 1;   // multiplicador de ATRIBUTO (qualidade/refino) p/ simular cenários
    const itens = META.itens || [];
    let apItem = 0, adItem = 0, apPct = 0, cdr = 0, pen = 0, penArmadura = 0, rvItens = 0, lich = 0, chama = false, liandry = false, crit = 0, infinito = false;
    let tem3036 = false;   // motor.js:552 `tem('3036')` — a pen de armadura do item encadeia com a do KIT
    const det = [];
    for (const raw of ids) {
      // `parseSlotId` resolve a BASE e a qualidade/refino ('3175~A', '4629+3~A', '3171~B+2') — o
      // ÚNICO intérprete desta sintaxe (o `efeitosEquipados` usa o mesmo). Antes isto casava o id
      // por IGUALDADE EXACTA: '3175~A' não existia no catálogo -> a peça valia ZERO (bug medido).
      const p = parseSlotId(raw);
      const id = String(p.base);
      const it = itens.find((x) => String(x.id) === id) || {};
      const m = p.mult * qm;   // qualidade/refino da peça × o multiplicador de cenário (`opt.mult`)
      let c = it.cdr || 0, pm = it.penMag || 0;
      const ef = String(it.efeito || '');
      if (!c) { const mm = ef.match(/[\u2212-]\s*(\d+)\s*%\s*(?:na\s*)?recarga/i); if (mm) c = +mm[1] / 100; }
      // PEN MAGICA vs PEN DE ARMADURA — sao COISAS DIFERENTES no motor:
      //   motor.js:529 `penMagica = min(0.6, (tem('3135') ? 0.4 : 0) + pct.penMag)` -> a pen MAGICA
      //     vem SO do 3135 (40%, pelo texto) e do campo `penMag` (3175, 15%). O 3036 NAO entra aqui.
      //   motor.js:539 `penArmadura = 1 - (1 - penE) * (tem('3036') ? 0.7 : 1)` -> o 3036 da 30% de
      //     pen de ARMADURA e so conta no ramo FISICO (motor.js:1202 `arm = magico ? ... : alvo.armadura
      //     * (1 - reducaoArmadura) * (1 - penArmadura)`).
      // BUG CORRIGIDO (2026-10-14): a regex generica `% de penetra` apanhava o texto do 3036
      // ('30% de penetracao de armadura') e arquivava-o como pen MAGICA — inflacionava o dano magico
      // em +13,0% (armadura 104) a +19,6% (armadura 200). Ver docs/pendencias-motor.md, lacuna 1.
      if (!pm) { const mm2 = ef.match(/(\d+)\s*%\s*de\s*penetra[çc][ãa]o\s*m[áa]gica/i); if (mm2) pm = +mm2[1] / 100; }
      let pa = it.penArmadura || 0;
      if (!pa && id === '3036') { pa = 0.3; tem3036 = true; }   // motor.js:539 (`0.7` = 1 - 0,30) + 552
      // O `mult` (qualidade/refino) aplica-se EXACTAMENTE à lista do motor (motor.js:254-255): ad, ap,
      // mana, vida, armadura, rm, va, rv, critico, regen e **cdr**. O `penMag` NÃO está nessa lista —
      // NÃO é escalado (o 3175~A dá 15% de pen, não 17,25%; a dica medida no jogo confirma:
      // docs/snapshots/farm.json). Correcção do Lead, 2026-10-14.
      apItem += (it.ap || 0) * m; adItem += (it.ad || it.dano || 0) * m; cdr += c * m; pen += pm; penArmadura += pa; rvItens += (it.rv || 0) * m;
      // CRITICO: a CHANCE soma (motor.js:507 `critico += i.critico`) e o 3031 da +0,4 no
      // MULTIPLICADOR (motor.js:515 `danoCritico += 0.4`). Ambos eram invisiveis ao scoring.
      crit += (it.critico || 0);
      if (id === '3031') infinito = true;
      if (id === RABADON) { apPct += 0.35; det.push('Rabadon +35%AP'); }
      if (id === '3100') { lich += 0.75; det.push('Lich +75%AP/skill'); }
      if (id === '4645') { chama = true; det.push('Chama +20% (<40%)'); }
      if (id === '6653') { liandry = true; det.push('Liandry queima 1,5%/s'); }
    }
    cdr = Math.min(CAP_CDR, cdr); pen = Math.min(CAP_PEN_MAG, pen);
    // ---- PEN DE ARMADURA: a do KIT encadeada com a dos ITENS (motor.js:552) ------------------
    //   motor.js:529  `penE = k.hab.E.pen && estado.ranks.E ? k.hab.E.pen[estado.ranks.E - 1] : 0`
    //   motor.js:552  `penArmadura: 1 - (1 - penE) * (tem('3036') ? 0.7 : 1)`
    // O MOTOR aplica a penetracao do kit SEMPRE (e por rank). A matematica de build ignorava-a
    // (TK-02-114): com o E do Darius a rank 4 (0,29) a pen ia de 0,30 (so o 3036) para
    // 1 - 0,71*0,70 = 0,503 — e o Cajado do Vazio / itens de pen ficavam SOBREVALORADOS.
    // `penArmaduraItens` fica separada para quem encadeia por-item (efeitosEquipados(ids)).
    // A pen dos ITENS ja vem encadeada (motor.js:539): o 3036 contribui 0,3 e o
    // `penArmaduraDe` do motor aplica o `* 0,7` UMA vez so
    // (motor.js:552 `1 - (1 - penE) * (tem('3036') ? 0.7 : 1)`). Aqui o 3036 ja entrou
    // no `penArmadura` (0,3), portanto o factor extra so se aplica quando NAO houve
    // contribuicao de item — senao contaria o 0,7 duas vezes (medido: 0,652 em vez de 0,503).
    const penArmaduraItens = Math.max(0, Math.min(1, penArmadura));
    const penKit = penKitCampeao('E');
    penArmadura = 1 - (1 - penKit) * (1 - penArmaduraItens) * (penArmaduraItens > 0 ? 1 : (tem3036 ? 0.7 : 1));
    // `pen` = pen MAGICA (motor.js:542, tecto 0,6) e `penArmadura` = pen de ARMADURA
    // (motor.js:552, so no ramo fisico).
    return { ap: apItem * (1 + apPct), ad: adItem, cdr, pen, penArmadura, rv: rvItens, penArmaduraItens, penKit, lich, chama, liandry, crit, infinito, det };
  }

  function estimarSet(ids, alvo, opt) {
    const p = player();
    const S = statsSet(ids, opt);
    const { cdr, pen, penArmadura, lich, chama, liandry, det } = S;
    const ap = S.ap;
    const sk = readSkills();
    let dps = 0; const habs = [];
    for (const h of (sk.arsenal || [])) {
      const k = KAT[h.t]; if (!k || k.passiva || !h.rank) continue;
      // BUG CORRIGIDO: usava só o AD do CAMPEÃO (p.dano, lido do DOM) e ignorava o AD
      // dos ITENS do conjunto. Efeito medido: dois conjuntos diferentes (Adaga 1042 vs
      // Martelo de Guerra 3133) davam o MESMO dps=58 no teste de builds, enquanto o
      // score (que já usa S.ad) dava 139 vs 156. Ou seja, a estimativa de DPS era cega
      // ao AD dos itens — e é ela que alimenta a rotação de skills e o previaSet.
      const adTotal = (p.dano || 0) + (S.ad || 0);
      // BUG CORRIGIDO (a causa real do dps irreal): o kit do motor guarda a escala da
      // habilidade em `ratio` (Yasuo Q = 0.55, que é AD) e NAO tem campo `adRatio`.
      // O codigo multiplicava `ratio` por `ap` — que num campeao AD e ZERO. Resultado:
      // todo o escalamento do Yasuo era multiplicado por zero e o dps saia ~63, cerca
      // de 10x abaixo do real (24-25 abates/min medidos). Agora `ratio` escala com o
      // tipo de dano do campeao: mago -> AP, AD -> AD total (campeao + itens).
      const magiaEsc = !!(META.champAtual && META.champAtual.magia);
      const escala = magiaEsc ? ap : adTotal;
      const direto = (k.base ? k.base(h.rank) : 0) + (typeof k.ratio === 'function' ? k.ratio(h.rank) : (k.ratio || 0)) * escala + (k.adRatio || 0) * adTotal;
      const total = direto * (k.mult || 1) + lich * ap;
      const cdBase = k.rec ? k.rec(h.rank) : null;
      const cd = cdBase != null ? cdBase * (1 - cdr) : null;
      const d = cd ? total / cd : 0;
      dps += d; habs.push({ t: h.t, nome: h.name, dps: Math.round(d) });
    }
    // MITIGAÇÃO PELO TIPO DE DANO do campeão (motor.js:1202):
    //   mágico -> armadura do alvo × RM_MONSTRO × (1 − penMagica)   [motor.js:1179, 529]
    //   físico -> armadura do alvo × (1 − penArmadura)             [motor.js:539]
    // TK-02-150: o ramo FÍSICO usava a pen MÁGICA (`pen`) — penetração que o motor só dá a quem bate com
    // magia. Num campeão AD isso infla o dano estimado e muda a escolha de itens: as duas pens
    // são coisas diferentes no motor (motor.js:529 vs 539) e cada uma fica no seu ramo.
    const magiaCh = !!(META.champAtual && META.champAtual.magia);
    const mit = 100 / (100 + (magiaCh ? armMagicaEfetiva(alvo?.armadura, pen) : (alvo?.armadura || 0) * (1 - penArmadura)));
    dps *= mit;
    if (chama) dps *= 1 + (alvo?.chefe ? 0.066 : 0.033);   // ~1/3 (chefe) / ~1/6 (mob) da luta abaixo de 40%
    let burn = 0;
    if (liandry && alvo?.hp) {
      const cv = (META.curva && META.curva.hp) || [150, 100, 1];
      const cap = 3 * (cv[0] + cv[1] * (alvo.nivel || 1) + cv[2] * (alvo.nivel || 1) ** 2);
      burn = Math.min(alvo.hp, cap) * 0.015; dps += burn;
    }
    return { hemorragia: (typeof hemorragiaDe === 'function' ? hemorragiaDe(p && p.nivel, p && p.bonusAd, alvo) : null), dps: Math.round(dps), ap: Math.round(ap), cdr: +cdr.toFixed(2), pen: +pen.toFixed(2), burn: Math.round(burn), habs: habs.sort((a, b) => b.dps - a.dps).slice(0, 5), det };
  }

  /** Multiplicador médio de ATRIBUTO dos itens EQUIPADOS (refino +12%/nv, qualidade): (1+0.12·ref)·multQual. */
  function multEquip(ids) {
    const Q = { C: 0.9, B: 1.0, A: 1.15, S: 1.35, SS: 1.7 };
    const eq = (() => { try { return readEquip(); } catch { return []; } })();
    const ms = ids.map((id) => { const e = eq.find((x) => x.base === String(id)); const rid = e ? e.id : String(id); const ref = (String(rid).match(/\+(\d+)/) || [])[1] || 0; const q = ((String(rid).match(/~([A-Za-z]+)/) || [])[1] || 'B').toUpperCase(); return (1 + 0.12 * (+ref)) * (Q[q] || 1); });
    return ms.length ? ms.reduce((a, b) => a + b, 0) / ms.length : 1;
  }
  /** DPS estimado em 3 cenários: refino-0/base, tier-A, e ATUAL (refino+qualidade equipados). */
  function dpsCenarios(ids, regiaoId) {
    const m = multEquip(ids);
    const cen = { ref0: 1, tierA: 1.15, atual: m };
    const out = { multAtual: +m.toFixed(3), ref0: {}, tierA: {}, atual: {} };
    for (const k of ['ref0', 'tierA', 'atual']) out[k] = previaSet(ids, regiaoId, { mult: cen[k] });
    return out;
  }

  // =====================================================================
  // PREVISOR EMPÍRICO: aprende com o HISTÓRICO real (cycles de mob + lutas de chefe)
  // A DPS teórica é péssima p/ farm (mede single-target; farm é AoE/clear).
  // Aqui usamos o que FOI MEDIDO: mobFase.perMin (ouro/xp/kills) e outDps das lutas.
  // =====================================================================
  const sigSet = (a) => [...(a || [])].map((x) => baseDe(String(x))).filter(Boolean).sort().join(',');
  const semAcento = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const media = (arr, k) => { const v = arr.map((x) => (x ? (typeof k === 'function' ? k(x) : x[k]) : null)).filter((x) => Number.isFinite(x)); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
  /** Rodadas de teste salvas (cache em memória; o previsor usa junto com os ciclos). */
  let testesSalvos = [];
  try { chrome.storage.local.get(STORAGE_KEY + ':testes', (r) => { testesSalvos = r?.[STORAGE_KEY + ':testes']?.rodadas || []; }); } catch { /* ignore */ }
  /** Histórico medido p/ uma assinatura de build: mob (ouro/xp/kills por min) e chefe (outDps/inDps/durS). */
  function previsorHistorico(ids, regiaoId) {
    const want = sigSet(ids);
    const reg = regiaoId ? semAcento(regiaoId) : null;
    const casa = (txt) => !reg || semAcento(txt).includes(reg);
    const mobs = [];
    const lut = [];
    for (const x of ((farm && farm.cycles) || [])) {
      if (!x || !x.mobFase || !x.mobFase.perMin || !x.setup || !x.setup.equip) continue;
      if (sigSet(x.setup.equip.map((e) => e.base)) !== want || !casa(x.region)) continue;
      const pm = x.mobFase.perMin;
      mobs.push({ at: x.endedAt || x.startedAt || 0, gold: pm.gold, xp: pm.xp, kills: pm.kills, dmg: pm.dmg });
    }
    for (const l of ((farm && farm.lutas) || [])) {
      if (!l || !l.analise || !Number.isFinite(l.analise.outDps) || sigSet(l.build) !== want || !casa(l.region)) continue;
      lut.push({ at: l.at || 0, outDps: l.analise.outDps, inDps: l.analise.inDps, durS: l.durS });
    }
    for (const rod of testesSalvos) {
      if (!rod || !casa(rod.regiao)) continue;
      for (const res of (rod.resultados || [])) {
        if (sigSet(res.itens) !== want) continue;
        if (res.mob) mobs.push({ at: rod.at || 0, gold: res.mob.goldMin, xp: res.mob.xpMin, kills: res.mob.killsMin });
        if (res.luta && Number.isFinite(res.luta.outDps)) lut.push({ at: rod.at || 0, outDps: res.luta.outDps, inDps: res.luta.inDps, durS: res.boss && res.boss.durS });
      }
    }
    const recentes = (arr, n) => arr.slice().sort((a, b) => (b.at || 0) - (a.at || 0)).slice(0, n);   // prioriza o mais RECENTE (gear/nível mudam)
    const mr = recentes(mobs, 8);
    const lr = recentes(lut, 8);
    const mob = mr.length ? { goldMin: media(mr, 'gold'), xpMin: media(mr, 'xp'), killsMin: media(mr, 'kills'), dmgMin: media(mr, 'dmg'), n: mr.length } : null;
    const chefe = lr.length ? { outDps: media(lr, 'outDps'), inDps: media(lr, 'inDps'), durS: media(lr, 'durS'), n: lr.length } : null;
    return { assinatura: want, mob, chefe, n: { mob: mr.length, chefe: lr.length } };
  }
  /** Previsor FINAL: usa o histórico quando existe (n≥1), senão cai no teórico. Retorna também a confiança. */
  function preverBuild(ids, regiaoId, alvo) {
    const h = previsorHistorico(ids, regiaoId);
    const t = previaSet(ids, regiaoId);
    const mob = h.mob ? { ...h.mob, fonte: 'historico' } : (t.mob ? { dps: t.mob.dps, fonte: 'teorico' } : null);
    const chefe = h.chefe ? { dps: Math.round(h.chefe.outDps), ...h.chefe, fonte: 'historico' } : (t.chefe ? { dps: t.chefe.dps, fonte: 'teorico' } : null);
    return { assinatura: h.assinatura, mobilidade: null, mob, chefe, teorico: { mob: t.mob, chefe: t.chefe }, confianca: h.n };
  }
  /** Ranking empírico das builds testadas (ordena por ouro/min real no mob e por outDps real no chefe). */
  function rankBuildsTestadas(regiaoId) {
    const seen = new Map();
    for (const x of ((farm && farm.cycles) || [])) {
      if (!x || !x.mobFase || !x.mobFase.perMin || !x.setup || !x.setup.equip) continue;
      const k = sigSet(x.setup.equip.map((e) => e.base));
      if (!seen.has(k)) seen.set(k, { assinatura: k, itens: (x.setup.equip.map((e) => e.base)), regiao: x.region, janelas: [] });
      // D (TK-01-42): ACUMULAR as janelas da MESMA assinatura. Sem isto o `if (!seen.has(k))`
      // descartava o 2.o ciclo e a celula ficava com UMA janela - logo nunca levava o aviso de
      // nao-comparabilidade entre execucoes diferentes (o defeito do w1-regioes D).
      if (x.janela != null) { const ent = seen.get(k); if (ent && ent.janelas.indexOf(x.janela) < 0) ent.janelas.push(x.janela); }
    }
    // TAMBÉM as rodadas de TESTE salvas (antes só os ciclos → metade das builds ficava de fora)
    for (const rod of (testesSalvos || [])) {
      if (!rod) continue;
      for (const res of (rod.resultados || [])) {
        if (!res || !res.itens || !res.itens.length) continue;
        const k = sigSet(res.itens);
        if (!seen.has(k)) seen.set(k, { assinatura: k, itens: res.itens.map(String), regiao: rod.regiao || null });
      }
    }
    // D (TK-01-42): cada celula traz as JANELAS em que foi medida e o AVISO de nao-comparabilidade
    // entre janelas (duas medidas de execucoes diferentes nao se comparam directamente).
    return [...seen.values()].map((s) => { const p = preverBuild(s.itens, regiaoId); const jan = Array.isArray(s.janelas) ? s.janelas : []; return { ...s, ...p, janelas: jan, avisoJanela: jan.length > 1 ? 'medida em ' + jan.length + ' janelas — nao comparavel directamente' : null }; });
  }

  /** Ranking NORMALIZADO: TODAS as builds medidas no MESMO patamar (tier A, refino 0) — comparação justa.
   *  Também devolve o real (item de verdade) e o empírico, pra ver o quanto o tier engana. */
  function rankNormalizado(regiaoId) {
    return rankBuildsTestadas(regiaoId).map((b) => {
      let c = null; try { c = dpsCenarios(b.itens, regiaoId); } catch { /* ignore */ }
      return {
        itens: b.itens, assinatura: b.assinatura,
        mobA: c && c.tierA && c.tierA.mob ? c.tierA.mob.dps : null,
        chefeA: c && c.tierA && c.tierA.chefe ? c.tierA.chefe.dps : null,
        mobReal: c && c.atual && c.atual.mob ? c.atual.mob.dps : null,
        chefeReal: c && c.atual && c.atual.chefe ? c.atual.chefe.dps : null,
        empMob: b.mob ? b.mob.goldMin : null,
        empChefe: b.chefe ? (b.chefe.outDps || b.chefe.dps) : null,
        n: b.confianca,
      };
    }).sort((a, b) => (b.mobA || 0) - (a.mobA || 0));
  }
  /** Estimativa PRÉVIA de um conjunto (score + DPS c/ passivas) vs alvo(s) de uma região. */
  function previaSet(ids, regiaoId, opt) {
    const L = (META.locais || []).find((x) => x.id === regiaoId);
    const alvos = {};
    try {
      if (L?.monstros?.[0]) { const s = statsMonstro(L.monstros[0][0], L.nm ? L.nm[1] : 1); if (s) alvos.mob = { armadura: s.armadura, hp: s.hp, nivel: L.nm ? L.nm[1] : 1, chefe: false }; }
      // NIVEL DO CHEFE pela regra do motor (motor.js:1121), nao `nm[1] + 2`.
      if (L?.chefe) { const nc = nivelChefeDe(L); const s = statsMonstro(L.chefe[0], nc); if (s) alvos.chefe = { armadura: s.armadura, hp: s.hp, nivel: nc, chefe: true }; }
    } catch { /* ignore */ }
    const est = (a) => { if (!a) return null; const e = estimarSet(ids, a, opt); return { dps: e.dps, score: Math.round(scoreSet(ids, { armadura: a.armadura })), ap: e.ap, cdr: e.cdr, pen: e.pen, burn: e.burn }; };
    return { mob: est(alvos.mob), chefe: est(alvos.chefe), regiao: regiaoId, itens: ids.slice() };
  }
  const TESTE_KEY = STORAGE_KEY + ':testes';

  /** DPS REAL/ESTIMADO POR ITEM: contribuição marginal de cada item no conjunto (mob e chefe).
   *  Calcula o DPS do set e o DPS do set SEM cada item — a diferença é o que aquele item adiciona. */
  function dpsItens(ids, regiaoId) {
    const L = (META.locais || []).find((x) => x.id === regiaoId);
    const alvos = {};
    try {
      if (L?.monstros?.[0]) { const s = statsMonstro(L.monstros[0][0], L.nm ? L.nm[1] : 1); if (s) alvos.mob = { armadura: s.armadura, hp: s.hp, nivel: L.nm ? L.nm[1] : 1, chefe: false }; }
      // NIVEL DO CHEFE pela regra do motor (motor.js:1121), nao `nm[1] + 2`.
      if (L?.chefe) { const nc = nivelChefeDe(L); const s = statsMonstro(L.chefe[0], nc); if (s) alvos.chefe = { armadura: s.armadura, hp: s.hp, nivel: nc, chefe: true }; }
    } catch { /* ignore */ }
    const nome = (id) => { const it = (META.itens || []).find((x) => String(x.id) === String(id)); return it ? (it.nome || String(id)) : String(id); };
    const calc = (a) => {
      if (!a) return null;
      const total = estimarSet(ids, a).dps;
      const porItem = ids.map((id) => { const sem = ids.filter((x) => String(x) !== String(id)); const d = Math.max(0, total - estimarSet(sem, a).dps); return { base: String(id), nome: nome(id), dps: d }; });
      return { total, porItem };
    };
    return { mob: calc(alvos.mob), chefe: calc(alvos.chefe) };
  }
  const totalDeaths = () => (farm.cycles || []).reduce((s, x) => s + (x.deaths || 0), 0) + (farm.current?.deaths || 0);
  let teste = null;   // { sets, i, fase, t0, regiao, mobSeg, resultados, cicloIni }
  const testeAtivo = () => !!teste;
  /** Estado do TESTE (não do farm): fase, elapsed, variação atual, quantas feitas. */
  function testeEstado() {
    if (!teste) return null;
    const s = teste.sets[teste.i] || {};
    const segFase = teste.t0 ? Math.round((Date.now() - teste.t0) / 1000) : 0;
    return {
      fase: teste.fase, i: teste.i, total: teste.sets.length, nome: s.nome || null,
      regiao: teste.regiao, mobAlvo: teste.mobSeg,
      mobSeg: teste.fase === 'mobs' ? segFase : null,                                   // 0→mobAlvo (60)
      chefeEspera: teste.killBoss ? Math.round((Date.now() - (teste.bossT0 || teste.t0)) / 1000) : null,
      matandoChefe: !!teste.killBoss,
      feitos: teste.resultados.length,
    };
  }
  function iniciarTeste(sets, opts = {}) {
    if (!sets || !sets.length) return { ok: false, motivo: 'sem conjuntos' };
    const regiao = opts.regiao || cfg.regionDefault || regiaoIdeal();
    // GUARDA: NAO iniciar teste numa regiao LETAL pro nivel atual (evita morrer no Dragao a nv baixo).
    // Uso: passar { forcar: true } pra ignorar conscientemente.
    try {
      const rr = estimarRegiao(regiao);
      const letal = rr && rr.risco && (rr.risco.mortal || rr.risco.morre);
      if (letal && !opts.forcar && !cfg.testeForcar) return { ok: false, motivo: `regiao ${regiao} LETAL no nv ${player().nivel} (${rr.risco.mecFatalNome || 'dano'} ${Math.round(rr.risco.dpsTomado || 0)} dps vs cura ${Math.round(rr.risco.curaTotal || 0)}). Use {forcar:true} p/ ignorar.` };
    } catch { /* ignore */ }
    teste = {
      sets: sets.map((s) => { const itens = (s.itens || s).map(String); return { nome: s.nome || 'conjunto', itens, previa: previaSet(itens, regiao), cenarios: dpsCenarios(itens, regiao) }; }),
      i: 0, fase: 'prep', t0: Date.now(), regiao,
      mobSeg: opts.mobSeg != null ? opts.mobSeg : (cfg.testeMobSeg || 20), resultados: [], inicio: Date.now(),
      hpMin: opts.hpMin != null ? opts.hpMin : (cfg.testeHpMin || 0.45),   // aborta se o HP cair abaixo disso
      setOriginal: readEquip().map((e) => baseDe(e.id)),
      deathBase: totalDeaths(),
    };
    logEvent('teste', { inicio: teste.sets.length, regiao: teste.regiao, mobSeg: teste.mobSeg, hpMin: teste.hpMin, original: teste.setOriginal, previa: teste.sets.map((s) => ({ nome: s.nome, ...s.previa })) });
    // PERSISTIR para AUTO-RETOMAR: o teste vivia só em memória e parava em SILÊNCIO a
    // cada reload do browser (medido 3×) — e o dono pediu melhorias "sem parar". Guardar
    // a CONFIG (sets/região/mobSeg) permite retomá-lo no arranque seguinte.
    try {
      chrome.storage.local.set({ [TESTE_KEY + ':ativo']: {
        sets: teste.sets.map((s) => ({ nome: s.nome, itens: s.itens })),
        regiao, mobSeg: teste.mobSeg, hpMin: teste.hpMin, at: Date.now(),
      } });
    } catch { /* ignore */ }
    return { ok: true, sets: teste.sets.length };
  }
  function pararTeste() {
    try { chrome.storage.local.remove(TESTE_KEY + ':ativo'); } catch { /* ignore */ }   // paragem explícita NÃO deve auto-retomar
    if (!teste) return { ok: true };
    const r = { sets: teste.sets.length, feitos: teste.resultados.length };
    teste = null; logEvent('teste', { fim: 'manual', ...r });
    return r;
  }
  /** Aborta a variação atual: foge pra base, restaura o set original e segue. */
  async function abortarVariacao(motivo, set) {
    const hp = (typeof window !== 'undefined' && window.__lolidleLive?.hp) || null;
    logEvent('teste', { conjunto: set?.nome, fim: 'ABORTADO', motivo, hp: hp ? Math.round(100 * hp.cur / hp.max) + '%' : null });
    if (teste) {
      teste.resultados.push({ ...(teste.atual || { conjunto: set?.nome, itens: set?.itens }), abortado: true, motivo });
      if (!naBase()) press('b');
      await esperar(esperaRecallMs());
      try { if (teste?.setOriginal?.length) await aplicarItens(teste.setOriginal); } catch { /* ignore */ }
      teste.i++; teste.fase = 'prep'; teste.t0 = Date.now(); teste.deathBase = totalDeaths();
      salvarTestes();
    }
    return 'abortado';
  }
  /** Garante que um item base esteja na mochila: tenta cofre aberto, depois cancela meu anúncio. */
  async function obterItem(base) {
    const win = q1('#janela-bolsa');
    if (win && win.hidden) { press('i'); await humano(350); }
    const bagSlot = melhorSlot('#mochila button.slot[data-id]', base);
    const bagI = bagSlot ? parseSlotId(bagSlot.getAttribute('data-id')) : null;
    if (win && !win.hidden) press('i');
    // cofre ABERTO: se tiver instância MELHOR que a da mochila, traz do cofre (melhorDoCofre já pega o melhor tier+refino)
    if (q1('.cofre-slot[data-k]')) {
      const melhor = melhorDoCofre(base);
      const melhorI = melhor ? { qual: melhor.qual || 'C', refino: melhor.refino || 0 } : null;
      const cofreMelhor = melhorI && (!bagI || qIdx(melhorI.qual) > qIdx(bagI.qual) || (qIdx(melhorI.qual) === qIdx(bagI.qual) && melhorI.refino > bagI.refino));
      if (!bagI || cofreMelhor) { const r = await retirarDoCofre(base); if (r.ok) return { ok: true, de: 'cofre', ...r }; }
    }
    if (bagI) return { ok: true, de: 'mochila', qual: bagI.qual, refino: bagI.refino };
    // 2) meu anúncio no mercado → cancela (volta pra mochila)
    try {
      const ofertas = await lerOfertas();
      const o = (ofertas || []).find((x) => String(x.base) === String(base));
      if (o) { const m = mercadoEl(false); cancelarOferta(o.id); await humano(500); if (m) q1('#janela-mercado [data-fechar]')?.click(); return { ok: true, de: 'mercado', nome: o.nome }; }
    } catch { /* ignore */ }
    return { ok: false, motivo: 'nao consegui obter ' + base };
  }

  /** Uma passo do teste (chamado no loop a cada ~3s). Devolve o estado. */
  async function passoTeste() {
    if (!teste || pausado) return teste ? 'pausado' : null;
    const c = farm.current;
    const set = teste.sets[teste.i];
    if (!set) {
      salvarTestes();
      logEvent('teste', { fim: 'volta', resultados: teste.resultados.length });
      if (cfg.testeLoop !== false) {   // LOOP: repete os conjuntos e acumula amostras (3x em 20s)
        teste.i = 0; teste.fase = 'prep'; teste.t0 = Date.now(); teste.resultados = []; teste.inicio = Date.now(); teste.deathBase = totalDeaths();
        logEvent('teste', { volta: true });
        return 'volta';
      }
      try { if (teste.setOriginal?.length) await aplicarItens(teste.setOriginal); } catch { /* ignore */ }   // restaura a build do dono
      teste = null; return 'fim';
    }
    // REDE DE SEGURANÇA: HP baixo ou morte -> aborta a variação e restaura o set original
    const hp = (typeof window !== 'undefined' && window.__lolidleLive?.hp) || null;
    if (hp && hp.max && teste.fase !== 'prep') {
      const pct = hp.cur / hp.max;
      if (pct < teste.hpMin) return await abortarVariacao('hp ' + Math.round(pct * 100) + '%', set);
    }
    if (totalDeaths() > (teste.deathBase || 0) && teste.fase !== 'prep') return await abortarVariacao('morte', set);
    // 1) preparar: equipa os itens do conjunto e vai pra região
    if (teste.fase === 'prep') {
      for (const b of set.itens) { if (!itemDisponivel(b)) await obterItem(b); }   // traz do mercado/cofre se faltar
      // CICLO POR CONJUNTO (fix): um ciclo só fechava quando a REGIÃO mudava. Como o
      // teste troca de conjunto mas FICA na mesma região, quase não gerava ciclos e o
      // backtesting (que lê `cycles`) ficava com n=1 por build, enquanto os rounds do
      // teste já tinham n=8. Fechar aqui dá UM CICLO POR VARIAÇÃO, com o setup (itens
      // equipados) daquela variação — é o que permite comparar builds por `cycles`.
      try {
        if (farm.current) {
          fechaFase(farm.current.fase === 'boss' ? farm.current.bossFase : farm.current.mobFase, Date.now());
          const old = farm.current;
          old.fim = 'teste'; old.incompleto = false;
          old.endedAt = Date.now(); old.durMs = old.endedAt - old.startedAt;
          const teveDados = (old.gold || 0) > 0 || (old.xp || 0) > 0 || (old.mobFase && old.mobFase.kills > 0) || !!old.boss;
          if (teveDados) { farm.cycles.unshift(old); farm.cycles = farm.cycles.slice(0, 30); }
          farm.current = null;
        }
      } catch { /* ignore */ }
      await aplicarItens(set.itens);
      const local = readLocation();
      if (localId(local.text) !== teste.regiao) { if (!naBase()) { press('b'); await esperar(esperaRecallMs()); } viajarPara(teste.regiao); await esperar(6000); }
      // abre já o ciclo desta variação (não esperar pelo próximo evento de log)
      try { const l2 = readLocation(); if (!/fonte/i.test(l2.text)) farm.current = novoCiclo(l2.text, Date.now()); } catch { /* ignore */ }
      publishFarm();
      teste.fase = 'mobs'; teste.t0 = Date.now(); teste.cicloIni = farm.cycles.length;
      logEvent('teste', { conjunto: set.nome, itens: set.itens, fase: 'mobs' });
      return 'mobs';
    }
    const live = (typeof window !== 'undefined' && window.__lolidleLive) || null;
    const bossAtivo = !!((c && c.boss) || (live && live.boss));
    const temBoss = (nome) => teste.resultados.some((r) => r.conjunto === nome && r.boss && r.boss.nome);
    const proximaSemBoss = () => teste.sets.findIndex((s) => !temBoss(s.nome));
    const equiparTxt = () => readEquip().map((e) => e.base + (e.refino ? '+' + e.refino : '') + (e.qual ? '~' + e.qual : ''));
    const proxima = () => { teste.i++; teste.fase = 'prep'; teste.t0 = Date.now(); teste.killBoss = false; teste.bossT0 = null; teste.atual = null; teste.mobUltimo = null; teste.deathBase = totalDeaths(); };
    const perMinLive = (mf) => { if (!mf) return null; if (mf.perMin) return mf.perMin; if (!mf.startedAt) return null; const el = (Date.now() - mf.startedAt) / 1000; if (el < 5) return null; return { gold: (mf.gold || 0) * 60 / el, xp: (mf.xp || 0) * 60 / el, potions: (mf.potions || 0) * 60 / el, kills: (mf.kills || 0) * 60 / el }; };
    const mobAtual = (seg) => { const mm = perMinLive(c?.mobFase) || teste.mobUltimo || null; return { conjunto: set.nome, itens: set.itens, regiao: teste.regiao, mobS: Math.round(seg), mob: mm ? { goldMin: mm.gold, xpMin: mm.xp, potMin: mm.potions, killsMin: mm.kills } : null, equipar: equiparTxt() }; };

    // CHEFE APARECEU (dentro do 1 min): mata com a build ATUAL; se ela já tem chefe testado, troca RÁPIDO p/ a próxima sem chefe
    if (bossAtivo && !teste.killBoss) {
      if (temBoss(set.nome)) {
        const j = proximaSemBoss();
        if (j >= 0 && j !== teste.i) { logEvent('teste', { troca: 'chefe; build atual ja testada no chefe', para: teste.sets[j].nome }); teste.i = j; teste.fase = 'prep'; teste.t0 = Date.now(); return 'troca p/ ' + teste.sets[j].nome; }
      }
      teste.killBoss = true; teste.bossT0 = Date.now(); teste.atual = teste.atual || mobAtual((Date.now() - teste.t0) / 1000);
      logEvent('teste', { conjunto: set.nome, fase: 'chefe (apareceu no 1 min)' });
    }

    // MATANDO O CHEFE: espera o ciclo fechar em 'chefe'
    if (teste.killBoss) {
      const t0b = teste.bossT0 || teste.t0;
      const fechou = (farm.cycles[0] && farm.cycles[0].fim === 'chefe' && farm.cycles[0].endedAt > t0b) || (c === null && (farm.cycles[0]?.endedAt || 0) > t0b);
      if (!fechou) return 'chefe ' + Math.round((Date.now() - t0b) / 1000) + 's';
      if (!teste.atual) teste.atual = mobAtual((t0b - teste.t0) / 1000);
      const cy = farm.cycles.find((x) => (x.endedAt || 0) > t0b) || farm.cycles[0] || null;
      const bm = cy?.bossFase?.perMin || null;
      const lut = (farm.lutas || []).find((l) => l.at > t0b) || null;
      teste.resultados.push({
        ...teste.atual,
        boss: cy ? { goldMin: bm?.gold || 0, xpMin: bm?.xp || 0, potMin: bm?.potions || 0, durS: cy.bossDurMs ? +(cy.bossDurMs / 1000).toFixed(1) : null, morreu: (cy.deaths || 0) > 0, nome: cy.boss || null } : null,
        luta: lut ? { estPot: lut.est?.potTotal ?? null, realPot: lut.potUsadas, outDps: lut.analise?.outDps, inDps: lut.analise?.inDps, healSkillS: lut.analise?.skillHealS, cor: lut.analise?.porCor || null } : null,
      });
      logEvent('teste', { conjunto: set.nome, fim: 'chefe', mortes: cy?.deaths || 0, bossS: cy?.bossDurMs ? Math.round(cy.bossDurMs / 1000) : null });
      salvarTestes();
      proxima();
      return 'proximo';
    }

    // MOBS: 1 min EXATO e passa pra PRÓXIMA build (chefe é opcional; só se aparecer nesse 1 min)
    if (teste.fase === 'mobs') {
      teste.mobUltimo = perMinLive(c?.mobFase) || teste.mobUltimo;   // guarda a taxa AO VIVO (no 60s o ciclo pode ter resetado)
      const seg = (Date.now() - teste.t0) / 1000;
      if (seg < teste.mobSeg) return 'mobs ' + Math.round(seg) + 's';
      teste.atual = mobAtual(seg);
      teste.resultados.push({ ...teste.atual, boss: null, luta: null });
      logEvent('teste', { conjunto: set.nome, fim: 'mob 1 min', mobS: Math.round(seg) });
      salvarTestes();
      proxima();
      return 'proximo';
    }
    return null;
  }
  function salvarTestes() {
    if (!teste) return;
    chrome.storage.local.get(TESTE_KEY, (r) => {
      const ant = r?.[TESTE_KEY]?.rodadas || [];
      const rodada = { at: teste.inicio, regiao: teste.regiao, mobSeg: teste.mobSeg, previa: teste.sets.map((s) => ({ nome: s.nome, cenarios: s.cenarios, ...s.previa })), resultados: teste.resultados };
      testesSalvos = [rodada, ...testesSalvos].slice(0, 20);
      chrome.storage.local.set({ [TESTE_KEY]: { rodadas: [rodada, ...ant].slice(0, 20) } });
    });
  }

  /** Lê os preços do mercado (aba Comprar): [{ base, qual, preco, txt }]. */
  function lerMercado() {
    const m = q1('#janela-mercado'); if (!m) return null;
    return [...m.querySelectorAll('.mj-card[data-grupo]')].map((c) => {
      const [base, qual] = (c.dataset.grupo || '').split('~');
      const txt = (c.textContent || '').replace(/\s+/g, ' ');
      const pr = txt.match(/a partir de\s*([\d.,]+\s*[kKmM]?)/i) || txt.match(/([\d.,]+\s*[kKmM]?)\s*ouro/i);
      return { base, qual, preco: pr ? parseBig(pr[1]) : null, txt: txt.slice(0, 110) };
    });
  }

  /** Lê Minhas ofertas (aba Minhas): [{ id, base, nome, qual, preco }]. */
  async function lerOfertas() {
    const m = mercadoEl(true); if (!m) return null;
    if (m.hidden) { press('j'); await esperar(500); }
    m.querySelector('[data-aba="minhas"]')?.click();
    await esperar(450);
    return [...m.querySelectorAll('[data-cancelar]')].map((b) => {
      const card = b.closest('article,li,div');
      const txt = (card?.textContent || '').replace(/\s+/g, ' ');
      const mq = txt.match(/\[([A-Z]{1,2})\]/);
      const pr = txt.match(/([\d.,]+\s*[kKmM]?)\s*ouro/i);
      const img = card?.querySelector('img')?.getAttribute('src') || '';
      return { id: b.dataset.cancelar, base: (img.match(/\/(\d+)\.png/) || [])[1] || null, nome: txt.split('[')[0].trim(), qual: mq ? mq[1] : null, preco: pr ? parseBig(pr[1]) : null, raridade: /lend/.test(txt) ? 'lendario' : /pic/.test(txt) ? 'epico' : 'basico', txt: txt.slice(0, 100) };
    });
  }

  /** PLANEJA o reajuste: compara minhas ofertas com o menor do mercado do MESMO item+qualidade. */
  async function planejarMercado() {
    const m = mercadoEl(true); if (!m) return { ok: false, motivo: 'sem mercado' };
    if (m.hidden) { press('j'); await esperar(500); }
    m.querySelector('[data-aba="comprar"]')?.click();
    await esperar(500);
    const mercado = lerMercado() || [];
    const minhas = await lerOfertas() || [];
    const acoes = [];
    for (const o of minhas) {
      if (isProtected({ kind: 'item', base: o.base, raridade: (infoItem(o.base) || {}).raridade, qual: o.qual })) {
        acoes.push({ id: o.id, base: o.base, nome: o.nome, qual: o.qual, acao: 'cancelar (protegido: lendário A+/Rabadon)' });
        continue;
      }
      const mk = mercado.find((x) => x.qual === o.qual && String(x.base) === String(o.base));
      if (!mk || mk.preco == null || o.preco == null) { if (!mk) acoes.push({ id: o.id, nome: o.nome, qual: o.qual, acao: 'manter (sem comparativo no mercado)' }); continue; }
      const alvo = Math.max(1, Math.round(mk.preco * 0.9));
      // SÓ SOBE — NUNCA abaixa o preço de uma oferta viva (o dono quer CARO; o mínimo do jogo é lixo)
      if (o.preco < alvo * 0.95) acoes.push({ id: o.id, base: o.base, nome: o.nome, qual: o.qual, de: o.preco, para: alvo, acao: 'reanunciar (subir p/ 90% do menor)' });
      else acoes.push({ id: o.id, nome: o.nome, qual: o.qual, acao: 'ok' });
    }
    const plano = { at: Date.now(), mercado: mercado.length, minhas: minhas.length, saturado: minhas.length >= 10, acoes, mercadoPrecos: mercado };
    logEvent('mercado', { acao: 'plano', reajustar: acoes.filter((a) => a.acao.startsWith('reanunciar')).length, n: minhas.length });
    return { ok: true, ...plano };
  }

  /** Preço MÍNIMO que o jogo aceita p/ o item selecionado (do painel `#mj-minimo`). */
  function minimoMercado() {
    const el = document.querySelector('#mj-minimo');
    const m = el && (el.textContent || '').match(/preço m[ií]nimo:\s*([\d.,]+)/i);
    return m ? parseBig(m[1]) : null;
  }
  /** Clica um botão de diálogo visível cujo texto casa com o regex. Devolve o texto clicado. */
  function clicarDialogo(re) {
    const b = [...document.querySelectorAll('button, .botao')].find((x) => {
      const t = (x.textContent || '').trim(); const r = x.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && !x.disabled && re.test(t);
    });
    if (b) { b.click(); return (b.textContent || '').trim(); }
    return null;
  }

  /** Anuncia um item da mochila pelo id-base (aba Vender), com preço. */
  async function anunciarItemPorBase(base, preco) {
    if (ehLendarioDaBuild(base)) return { ok: false, motivo: 'lendario da build da classe — nao anuncia' };   // REGRA DO DONO
    // PRIORIDADE EXTREMA (3031/3089, automation.js:47): nunca anunciado, NEM DUPLICADO (regra do dono).
    if (ehPrioridadeExtrema(base)) { const e = prioExtremaDe(base); return { ok: false, motivo: `PRIORIDADE EXTREMA (${e.motivo}) — nao anuncia [${e.fonte}]` }; }
    const m = mercadoEl(true); if (!m) return { ok: false, motivo: 'sem mercado' };
    if (m.hidden) { press('j'); await esperar(500); }
    m.querySelector('[data-aba="vender"]')?.click();
    await humano(380);
    const b = [...m.querySelectorAll('[data-escolher]')].find((s) => {
      const img = s.querySelector('img')?.getAttribute('src') || '';
      return img.includes('/' + base + '.');
    });
    if (!b) return { ok: false, motivo: 'sem ' + base + ' na mochila' };
    b.click(); await humano(320);
    // ESPERA o painel de referência do jogo carregar (ele busca o preço no servidor)
    let min = minimoMercado();
    for (let i = 0; i < 14 && !min; i++) { await esperar(150); min = minimoMercado(); }
    // NUNCA anuncia sem preço PRÓPRIO (o mínimo do jogo é MUITO baixo — vendia barato!)
    if (!(preco >= 1)) return { ok: false, motivo: 'sem preco de referencia (nao anuncia no minimo)' };
    const precoFinal = min ? Math.max(preco, min) : preco;
    const inp = m.querySelector('#vender-preco');
    if (inp) { inp.value = String(precoFinal); inp.dispatchEvent(new Event('input', { bubbles: true })); }
    const an = m.querySelector('[data-anunciar]');
    if (!an) return { ok: false, motivo: 'sem botao anunciar' };
    an.click(); await esperar(450);
    if (clicarDialogo(/usar o pre\u00e7o m[ií]nimo/i)) {          // era abaixo do mínimo → preenche e repete
      await esperar(350);
      m.querySelector('[data-anunciar]')?.click(); await esperar(450);
    }
    clicarDialogo(/^(anunciar|entendi|ok|sim)$/i);                 // confirma eventual "bem abaixo do normal"
    await esperar(300);
    logEvent('mercado', { acao: 'anunciar', base, preco: precoFinal, min });
    return { ok: true, base, preco: precoFinal, min };
  }

  /** EXECUTA o reajuste: cancela e reanuncia cada oferta no alvo (90% do menor). */
  async function executarMercado(plano) {
    plano = plano || await planejarMercado();
    if (!plano || !plano.ok) return { ok: false, motivo: 'sem plano' };
    ocupado = true;
    const exec = [];
    const mm = mercadoEl(true); if (mm && mm.hidden) { press('j'); await esperar(600); }
    const alvos = (plano.acoes || []).filter((a) => a.acao.startsWith('reanunciar') && a.base);
    // 1) CANCELA tudo primeiro (aba Minhas), re-selecionando a aba a cada cancelamento
    for (const a of alvos) {
      mm?.querySelector('[data-aba="minhas"]')?.click(); await esperar(320);
      await cancelarOferta(a.id); await esperar(550);
    }
    // 2) RE-ANUNCIA no alvo (aba Vender)
    for (const a of alvos) {
      const r = await anunciarItemPorBase(a.base, a.para);
      exec.push({ nome: a.nome, qual: a.qual, de: a.de, para: a.para, feito: !!r.ok, motivo: r.motivo || null });
      await esperar(420);
    }
    // protegidos: só cancela
    for (const a of (plano.acoes || [])) {
      if (a.acao !== 'cancelar (protegido: lendário A+/Rabadon)') continue;
      mm?.querySelector('[data-aba="minhas"]')?.click(); await esperar(320);
      await cancelarOferta(a.id); await esperar(400);
      exec.push({ nome: a.nome, qual: a.qual, acao: 'cancelado (protegido)', feito: true });
    }
    const ok = exec.filter((e) => e.feito).length;
    logEvent('mercado', { acao: 'executar', reajustados: ok, total: exec.length });
    ocupado = false;
    return { ok: true, reajustados: ok, exec };
  }

  /** QUALIDADES do motor (motor.js:174-178, `mult`). ERA UMA SEGUNDA COPIA deste mapa no mesmo
   *  ficheiro (havia tambem `QUAL_MULT` mais acima) — duas copias divergentes a espera de acontecer.
   *  Fica um so nome, apontando para a primeira (motor.js:174-178). */
  const Q_MULT = QUAL_MULT;

  /** PERFIL a partir de um campeão do motor (`magia` + `papel.dano/recebido` + `distancia`). */
  function perfilDe(c) {
    c = c || {};
    const pap = c.papel || {};
    const dano = pap.dano != null ? pap.dano : 1;
    const receb = pap.recebido != null ? pap.recebido : 1;
    if (c.magia) return (dano < 1.0 || receb <= 0.66) ? 'tanque' : 'mago';   // taric(0.9)/zac(0.66) × lux/katarina
    if (receb <= 0.62 && dano < 1.0) return 'tanque';                        // darius
    if (c.distancia) return 'atirador';                                       // ezreal
    return 'dano';                                                            // yasuo
  }
  /** PERFIL do campeão — com `c` explícito usa ESSE campeão (a build de um boneco não pode
   *  depender de quem está em campo: ver `valorPassiva(base, c)` e `montarBuildDe(c, fase)`).
   *  Sem `c`, mantém o comportamento de sempre (o campeão ACTUAL, com re-detecção). */
  function perfilCampeao(c) { garantirCampeao(); return perfilDe(c || META.champAtual); }
  /** Pesos por stat segundo o perfil (o que o campeão REALMENTE quer). `cdr` é 0-1. */
  /** PESOS por stat e por perfil. `penMag` estava AUSENTE (correcção do Lead, 2026-10-14): o
   *  campo `penMag` do catálogo não entrava em soma nenhuma — só o TEXTO da passiva o pontuava
   *  (`valorPassiva`, `* (ap ? 7 : 1)`). MEDIDO com a matemática do motor (tools/sim-build.mjs):
   *  a bota de PEN (3175) + Ímpeo (4629) DOMINA a bota de CDR (3171) em AP, CDR e pen ao mesmo
   *  tempo (AP 899 vs 859, CDR 15% vs 8%, pen 55% vs 40%), e ganha em TODAS as armaduras de 0 a
   *  200+ — porque o motor aplica o pen em `mit()` (motor.js:1179 / automation.js:5482).
   *  A ESCALA é a MESMA que a passiva já usava para o pen (7 por 1% = 700 por unidade em AP;
   *  1 por 1% = 100 nos outros perfis) — nenhum peso inventado. */
  // ============ PESO DO ROUBO DE VIDA — derivado do MOTOR, nao de gosto ============
  //  motor.js:1226-1228  `if (a.rouboVida && fonte === 'ataque') {
  //                          const cura = dano * a.rouboVida, falta = a.vida - estado.vida;
  //                          curar(estado, c, a, cura); ... }`
  //  motor.js:1286       `curar(estado, c, a, dano * d.furiaRoubo)` (Furia Sanguinea)
  //  Ou seja: `rv = 1,0` cura `1,0 x dps` de vida por segundo, SEM parar de atacar, e so no
  //  AUTO-ATAQUE (`fonte === 'ataque'`). Vale ~269 de cura/s numa base AD (AGENTS.md, prova n.o 5).
  //
  //  PARA COMPARAR COM OS OUTROS STATS a cura tem de entrar na MESMA unidade — e a unidade da
  //  piscina de vida e o peso `vida`: curar `rv x dps x T` de vida vale o mesmo que ter
  //  `rv x dps x T` de vida maxima. Donde:
  //      w.rv = w.vida x dpsRef x T_REF x escalaAD
  //    dpsRef   = 300   (base AD medida: ~150 de AD x ~2,0 de velocidade de ataque. O `meuDps()`
  //                      mede o DPS real e e esse que alimenta a SOBREVIVENCIA — o `avaliar`
  //                      agora soma `rv x dps x mit` (motor.js:1226). Aqui e o valor estatico)
  //    T_REF    = 10 s  (janela de luta: a ordem de grandeza do `tKill`/`intervalo` que o
  //                      `avaliar` ja modela)
  //    escalaAD = min(1, w.ad / AD_REF_PESO) — o roubo de vida SO cura no auto-ataque; um perfil
  //                      com `ad: 0` (o MAGO) nao tem auto que cure: fica 0, como o motor.
  //
  //  MEDIDO (catalogo real, docs/game-src/itens.js): a Sedenta por Sangue (3072, rv 0,15 + 80 AD)
  //  valia 0,45 pontos num perfil 'dano' contra 157,95 do AP do Rabadon (3089, ap 130 x 1,2) =
  //  0,285% — 'quase nada'. Com a formula: 0,15 x 0,03 x 300 x 10 = 13,5 pontos = 8,5% do Rabadon.
  //  E o que a auditoria media no jogo: trocar o 3153 por um item de rv muda a luta do Barao de
  //  35,15 s com 12 pocoes (760 g) para 79,6 s com 61 (6.450 g) — docs/auditoria-do-jogo.md C8.
  const AD_REF_PESO = 1.4;          // peso `ad` do perfil 'dano' (a referencia AD do ficheiro)
  const DPS_REF_RV = 300;           // DPS de auto-ataque de referencia (base AD: ~150 AD x ~2,0 va)
  const T_REF_RV = 10;              // segundos: janela de luta de referencia
  const rvPeso = (w) => Math.round((w.vida || 0) * DPS_REF_RV * T_REF_RV * Math.min(1, (w.ad || 0) / AD_REF_PESO) * 100) / 100;
  function pesosItem(perfil) {
    if (perfil === 'tanque') return { ad: 0.2, ap: 0.3, va: 50, critico: 0, rv: rvPeso({ vida: 0.7, ad: 0.2 }), vida: 0.7, armadura: 3, rm: 3, cdr: 200, penMag: 100, mana: 0.01, regen: 0.5 };
    if (perfil === 'mago') return { ad: 0, ap: 1.2, va: 80, critico: 0, rv: rvPeso({ vida: 0.15, ad: 0 }), vida: 0.15, armadura: 0.3, rm: 0.3, cdr: 300, penMag: 700, mana: 0.03, regen: 0.6 };
    if (perfil === 'suporte') return { ad: 0.4, ap: 0.8, va: 60, critico: 0, rv: rvPeso({ vida: 0.4, ad: 0.4 }), vida: 0.4, armadura: 1.2, rm: 1.2, cdr: 300, penMag: 100, mana: 0.02, regen: 0.6 };
    if (perfil === 'atirador') return { ad: 1.3, ap: 0, va: 400, critico: 500, rv: rvPeso({ vida: 0.03, ad: 1.3 }), vida: 0.03, armadura: 0.15, rm: 0.15, cdr: 120, penMag: 100, mana: 0.01, regen: 0.2 };
    return { ad: 1.4, ap: 0.9, va: 350, critico: 400, rv: rvPeso({ vida: 0.03, ad: 1.4 }), vida: 0.03, armadura: 0.15, rm: 0.15, cdr: 180, penMag: 100, mana: 0.01, regen: 0.2 };   // dano
  }
  /** CLASSE do item (motor.classeItem): 'ad', 'ap' ou 'neutro'. */
  function classeItem(base) {
    const it = (META.itens || []).find((x) => String(x.id) === String(base));
    if (!it) return 'neutro';
    const ad = it.ad || it.critico || it.va || it.rv;
    return it.ap && !ad ? 'ap' : ad && !it.ap ? 'ad' : 'neutro';
  }
  /** Item da CLASSE ERRADA (mago com AD, Yasuo com AP) vale quase nada; item SÓ-DEFENSIVO
   *  num campeão OFENSIVO (mago/dano/atirador) também vale pouco (ele quer farmar/matar). */
  /** PENALIZAÇÃO do item da CLASSE OPOSTA no scoring (configurável em `cfg.pesoClasseOposta`).
   *  O motor do jogo NÃO restringe itens por classe — esta penalização é da extensão; o default 0.12
   *  é o valor de sempre. MEDIDO: subir para 0.75/1.0 NÃO muda a build da Katarina (o bloqueio dela
   *  é o perfil `mago` com `ad: 0`, não esta penalização). */
  const pesoClasseOposta = () => Math.max(0, Math.min(1, numOr(cfg.pesoClasseOposta, 0.12)));
  function pesoClasse(base) {
    const c = META.champAtual || {};
    const it = (META.itens || []).find((x) => String(x.id) === String(base)) || {};
    const perfil = perfilCampeao();
    const ofensivo = (it.ad || 0) + (it.ap || 0) + (it.va || 0) + (it.critico || 0) + (it.rv || 0) + (it.cdr || 0);
    if (perfil !== 'tanque' && ofensivo === 0) return 0.3;
    const cl = classeItem(base);
    if (cl === 'neutro') return 1;
    return cl === (c.magia ? 'ap' : 'ad') ? 1 : pesoClasseOposta();
  }

  // =====================================================================================
  // BUILD POR FASE — MOB × CHEFE  (pedido do dono, 2026-10-14)
  //
  // "tem q saber melhor build pra enfrentar mob e melhor build pra enfrentar chefe ... e vai
  //  alternar entre o melhor pra mob e o melhor pra chefe SOZINHO. e isso e desativavel. mas
  //  ativado por padrao."
  //
  // O QUE MUDA ENTRE AS DUAS: só a VALORIZAÇÃO dos mesmos stats/itens. A lista de itens vem
  // SEMPRE do catálogo do motor (META.itens), e cada peso abaixo cita o ponto EXACTO do motor
  // que o justifica. Nada aqui é número inventado.
  //
  // ── MOB (farm): VÁRIOS alvos, vida baixa, armadura baixa, luta curta ──────────────────
  //   · dano em ÁREA: o motor bate nos OUTROS inimigos alcançados —
  //       motor.js:1718 (Furacão de Runaan: +2 inimigos por ataque)
  //       motor.js:1719 (Quebrapassos: +80% do AD em TODOS os alcançados, a cada 5 s)
  //       motor.js:1720 (Hidra Raivosa: 40% do AD nos outros, em CADA ataque)
  //       motor.js:1721 (Hidra Titânica: +1,5% da vida MÁXIMA em todos os alcançados)
  //   · Velocidade de Ataque: motor.js:534 (velAtaque) e motor.js:1675 (d.ataque = 1/velAtaque
  //     = ataques por segundo); no Yasuo ainda baixa a recarga da Q (motor.js:2056
  //     recargaQYasuo). Mais ataques = mais mortes por minuto.
  //   · Crítico: motor.js:541 (chance) e motor.js:1700 (Math.random() < a.critico).
  //   · Os mobs batem MENOS e têm MENOS armadura que os chefes — motor.js:281-293
  //     (ad 0.8–1.5, armadura 0.3–1.6) contra motor.js:295-297 (ad 2.5–3.2, armadura 1.5–1.8).
  //     Logo vida/armadura/RM valem MENOS e a penetração rende pouco (mitigar, motor.js:1167).
  //
  // ── CHEFE: UM alvo, vida alta, armadura alta, luta longa ──────────────────────────────
  //   · Penetração de armadura: motor.js:539 (3036 = 30%) aplicada em motor.js:1202
  //     (arm = alvo.armadura × (1 − penArmadura)). E o MESMO item dá +15% de dano contra
  //     chefes, SÓ contra chefes: motor.js:1214 (if (alvo.chefe && a.tem?.('3036'))).
  //   · Dano crítico: motor.js:515 (3031 = +40%) aplicado em motor.js:1213
  //     (if (critico) dano *= a.danoCritico).
  //   · Redução de armadura por ataque (Cutelo Negro, motor.js:1705): só rende em luta longa.
  //   · Itens de % da vida do alvo batem no TETO — motor.js:1191 (vidaRefItem) limita a 3× a
  //     curva de vida; um chefe tem 10–16× essa curva (motor.js:295-297), logo rendem o máximo.
  //   · Sobrevivência: motor.js:1733 (a defesa — armadura/RM — corta o golpe recebido) e
  //     motor.js:1186 (fatorDanoMonstro: monstro 4+ níveis acima bate até 3× mais forte).
  //   · Roubo de vida (motor.js:538 rouboVida, aplicado em motor.js:1226): luta longa = mais cura.
  //
  // COMO É USADO: pesosItemFase multiplica os pesos do PERFIL (pesosItem) e bonusItemFase
  // multiplica o valor de um item que o motor lê PELO ID (não é a soma dos stats). Com
  // cfg.buildPorFase === false nada disto é chamado (comportamento antigo, uma build só).
  // =====================================================================================
  const PESO_FASE = {
    mobs: {
      stat: { va: 1.4, critico: 1.1, cdr: 1.15, ad: 1, ap: 1, rv: 1, vida: 0.9, armadura: 0.85, rm: 0.85, mana: 1, regen: 1 },
      itens: {
        '3085': { mult: 1.9, why: 'Furacão de Runaan: cada ataque atinge mais 2 inimigos [motor.js:1718]' },
        '6631': { mult: 1.8, why: 'Quebrapassos: +80% do AD em TODOS os alcançados, a cada 5 s [motor.js:1719]' },
        '3074': { mult: 1.7, why: 'Hidra Raivosa: 40% do AD nos outros alcançados em CADA ataque [motor.js:1720]' },
        '3748': { mult: 1.5, why: 'Hidra Titânica: +1,5% da vida máxima em todos os alcançados [motor.js:1721]' },
        '3046': { mult: 1.6, why: 'Dançarina Fantasma: +6% de velocidade de ataque por ataque, até 5× [motor.js:1707]' },
        '6610': { mult: 1.35, why: 'Céu Dividido: o primeiro ataque em CADA inimigo é crítico [motor.js:1699]' },
        // Eco de Luden: o item de ÁREA do mago — em mobs o alvo é o GRUPO (motor.js:1947-1948
        // bate em ATÉ 3 inimigos); no chefe (um alvo só) ele perde para a Liandry, cujo % da
        // vida máxima bate no teto contra vida alta (motor.js:1191). A CONTA que fixa o
        // multiplicador: com 400 de AP o Eco faz (100 + 40) × 3 alvos = 420 por 6 s ≈ 70/s no
        // grupo, contra ≈ 30/s da Liandry num mob de ~2 000 de vida. O multiplicador é a minha
        // CALIBRAÇÃO sobre a direcção que o motor fixa (o valor da passiva da Liandry já entra
        // a +140 pelo texto; a do Eco não tem regra em `valorPassiva`).
        '6655': { mult: 1.9, why: 'Eco de Luden: a cada 6 s a habilidade bate em até 3 inimigos, 100 + 10% do AP [motor.js:1945]' },
        '3742': { mult: 1.2, why: 'Couraça do Defunto: +40 de dano fixo a cada 4 s — pesa mais contra vida baixa [motor.js:1698]' },
      },
    },
    chefe: {
      stat: { va: 1, critico: 1.15, cdr: 1, ad: 1.05, ap: 1.05, rv: 1.2, vida: 1.3, armadura: 1.25, rm: 1.25, mana: 1, regen: 1.1 },
      itens: {
        '3036': { mult: 2.2, why: 'Lembranças do Lorde Dominik: 30% de penetração de armadura [motor.js:539] + 15% de dano CONTRA CHEFES [motor.js:1214]' },
        '3031': { mult: 1.7, why: 'Gume do Infinito: +40% no dano do acerto crítico [motor.js:515 → motor.js:1213]' },
        '3071': { mult: 1.5, why: 'Cutelo Negro: −6% de armadura do alvo por ataque, até 30% — só rende em luta longa [motor.js:1705]' },
        '3153': { mult: 1.45, why: 'Espada do Rei Destruído: 5% da vida atual do alvo, com teto de 3× a curva — o chefe bate no teto [motor.js:1702, motor.js:1191]' },
        '6653': { mult: 1.4, why: 'Liandry: queima 1,5% da vida máxima por segundo, com teto — o chefe bate no teto [motor.js:1207, motor.js:1191]' },
        '3135': { mult: 1.35, why: 'Cajado do Vazio: 40% de penetração mágica [motor.js:529]' },
        '3065': { mult: 1.2, why: 'Rookern: +25% em TODA a cura recebida — luta longa [motor.js:1286]' },
        '6333': { mult: 1.25, why: '30% do dano recebido vira sangramento; abater cura 15% [motor.js:1790, motor.js:2701]' },
        '3026': { mult: 1.3, why: 'Renascimento: volta com 50% da vida — morrer no chefe custa muito [motor.js:2729]' },
        '3053': { mult: 1.25, why: 'Escudo de 60% da vida bónus abaixo de 30% de vida [motor.js:2725]' },
        '3157': { mult: 1.2, why: 'Stasis: invulnerável 2,5 s abaixo de 25% de vida [motor.js:2722]' },
      },
    },
  };
  // ============ PASSIVAS QUE ESCALAM COM O ALVO (correcção do Lead, 2026-10-14) ============
  // MEDIDO (`tools/sim-chefes.mjs`, docs/sim-baron.md): a `3153` Espada do Rei Destruído é a peça
  // que DECIDE a luta contra o Barão (Yasuo 7025 dps contra 2041 da build do motor = 3,4x;
  // Katarina 2757 contra 993 = 2,8x) e NENHUMA build do motor a tinha.
  // CAUSA CONFIRMADA: o scoring era CEGO AO ALVO — a `3153` recebia só
  // `valorPassiva` = 25 (Yasuo) / 15 (Katarina) pontos do TEXTO, mais o bónus fixo de fase 1.45,
  // e nunca entrava. Uma passiva que escala com a VIDA DO ALVO não tem como ser valorizada por um
  // modelo que só olha para stats próprios do item.
  // FÓRMULA DO MOTOR (nada inventado):
  //   motor.js:1702 `if (a.tem('3153')) bruto += 0.05 * vidaRefItem(alvo, alvo.hp);`
  //   motor.js:1191 `vidaRefItem(alvo, vida) = min(vida, TETO_VIDA_ITEM * CURVA.hp(nivel))`
  //   motor.js:1190 `TETO_VIDA_ITEM = 3`
  const PASSIVA_POR_ALVO = [
    { id: '3153', fracao: 0.05, teto: 3, fonte: 'motor.js:1702 + motor.js:1191 (TETO_VIDA_ITEM motor.js:1190)' },
  ];
  /** ALVO DE REFERÊNCIA para pontuar as passivas que escalam com a vida do alvo.
   *  - 'mobs' : o monstro mais pesado da região actual (vida baixa -> a passiva %vida vale pouco);
   *  - 'chefe': o chefe da região actual; sem região conhecida, o chefe do local de MAIOR tier
   *             (o conteúdo mais duro — o mesmo critério de dureza que o jogo usa);
   *  - null   : a build IDEAL pontua contra o CHEFE (é a build que enfrenta o conteúdo mais duro;
   *             o farm de mobs tem build própria em `buildIdealParaFase(c,'mobs')`, que NÃO muda).
   *  Devolve `{ nome, nivel, hp }` (hp da curva do motor, via `statsMonstro`). */
  function alvoDeReferencia(fase) {
    const doLocal = (l, chefe) => {
      if (!l) return null;
      const nome = chefe ? (l.chefe && l.chefe[0]) : ((l.monstros || []).slice().sort((a, b) => b[1] - a[1])[0] || [])[0];
      if (!nome) return null;
      const base = l.nm || l.faixa || [1, 1];
      // motor.js:1121: o chefe nasce em max(n0+2, min(n1+2, nivel+4)) — nao no topo da faixa.
      const nivel = chefe ? nivelChefeDe({ nm: base }) : base[0];
      const s = statsMonstro(nome, nivel);
      return s ? { nome, nivel, hp: s.hp } : null;
    };
    try {
      const loc = (META.locais || []).find((l) => l.id === localId(readLocation().text));
      const maisDuro = (META.locais || []).filter((l) => !ehRuneterra(l)).slice().sort((a, b) => (b.tier || 0) - (a.tier || 0))[0];
      if (fase === 'mobs') return doLocal(loc, false) || doLocal(maisDuro, false);
      return doLocal(loc, true) || doLocal(maisDuro, true);
    } catch { return null; }
  }
  /** VALOR (em pontos de stat) da passiva que ESCALA COM O ALVO — ver `PASSIVA_POR_ALVO`.
   *  A escala é a do stat de DANO do perfil (`w.ad`; nos perfis sem ad, `w.ap`): é a MESMA unidade
   *  que o `poder()`/`stats` já usam, para o número ser comparável com os outros itens. */
  function valorPctVida(base, alvo, c) {
    const p = PASSIVA_POR_ALVO.find((x) => x.id === basePura(base));
    if (!p || !alvo || !(alvo.hp > 0)) return 0;
    const cv = (META.curva && META.curva.hp) || [150, 100, 1];
    const n = alvo.nivel || 1;
    const teto = p.teto * (cv[0] + cv[1] * n + cv[2] * n * n);
    const porAuto = Math.min(p.fracao * alvo.hp, teto);
    const w = pesosItem(perfilDe(c || META.champAtual || {}));
    const escala = (w.ad || 0) > 0 ? w.ad : (w.ap || 1);
    return porAuto * escala;
  }
  /** NOME de utilizador de cada fase (a GUI e o log falam assim). */
  const NOME_FASE = { mobs: 'mobs', chefe: 'chefe' };
  /** PESOS do perfil JÁ corrigidos pela fase (multiplicadores de stat do PESO_FASE). */
  function pesosItemFase(perfil, fase) {
    const base = pesosItem(perfil);
    const f = PESO_FASE[fase];
    if (!f) return base;
    const out = {};
    for (const k of Object.keys(base)) out[k] = base[k] * (f.stat[k] != null ? f.stat[k] : 1);
    return out;
  }
  /** BÓNUS de fase de um item que o motor lê PELO ID (não é a soma dos stats). 1 = nenhum. */
  function bonusItemFase(base, fase) {
    const f = PESO_FASE[fase];
    const b = f && f.itens[String(base == null ? '' : base).replace(/[+~].*$/, '')];
    return b ? b.mult : 1;
  }
  /** PORQUE é que este item está nesta build (texto com file:linha), ou null. */
  function motivoFase(base, fase) {
    const f = PESO_FASE[fase];
    const b = f && f.itens[String(base == null ? '' : base).replace(/[+~].*$/, '')];
    return b ? b.why : null;
  }
  /** A FASE da build que o motor deve vestir AGORA. null = alternância DESLIGADA
   *  (cfg.buildPorFase === false) → comportamento antigo, uma build só. */
  function faseBuild() { return cfg.buildPorFase === false ? null : faseAtual(); }

  // =====================================================================================
  // TRATAMENTO ESPECIAL DE ITENS POR CAMPEÃO  (resposta directa ao dono:
  // "ele deve saber que tipo de itens devem receber tratamento especial pra cada campeão,
  //  igual o rabadon tambem")
  //
  // O QUE ISTO É: um MAPA item -> (para que classe, porque, file:linha do motor). Antes disto
  // o Rabadon era uma guarda SOLTA no código (`const RABADON = '3089'`, automation.js:25) e o
  // equivalente AD (Gume do Infinito, motor.js:515) não existia em lado nenhum.
  //
  // COMO FOI DERIVADO (não é hardcode solto):
  //   (a) `grep "tem('[0-9]+')" docs/game-src/motor.js` -> TODOS os pontos em que o motor lê um
  //       item pelo ID para mudar a REGRA dele (e não só a soma dos stats). Cada linha da
  //       tabela abaixo cita o file:linha dessa leitura.
  //   (b) o catálogo pode declarar campos MULTIPLICATIVOS (`adPct`/`apPct`/`vidaPct`/`armPct`/
  //       `rmPct`/`esquiva`/`penMag`) que o motor soma em `pct` e aplica ao TOTAL
  //       (motor.js:501 `const pct = {...}`; motor.js:511/523). Um item com um destes é, POR
  //       DEFINIÇÃO DO MOTOR, um item de tratamento especial -> `especiaisDoCatalogo()`
  //       acrescenta-os sozinho (sem ninguém os escrever aqui).
  //
  // `papel`: para que campeão o item é especial, na MESMA taxonomia do motor
  //   (`classeItem`, motor.js:22: 'ad' usa ad/critico/va/rv, 'ap' usa ap, senão 'neutro').
  // `meu`:  verdadeiro quando o item é especial PARA O CAMPEÃO ACTUAL — mesma classe de dano,
  //   ou 'neutro'/'tanque' num tanque. É isto que faz o tratamento ser POR CAMPEÃO.
  // =====================================================================================
  const ITENS_ESPECIAIS = [
    // ---------------- AD (o equivalente do Rabadon para o Yasuo/Darius/Ezreal) ----------------
    { id: '3031', papel: 'ad', tipo: 'critico',     motivo: '+40% no dano do acerto crítico (o Yasuo critica 2x por passiva)', fonte: 'motor.js:515' },
    { id: '3036', papel: 'ad', tipo: 'penetracao',  motivo: '30% de penetração de armadura', fonte: 'motor.js:539' },
    { id: '3071', papel: 'ad', tipo: 'penetracao',  motivo: 'cada ataque reduz 6% da armadura do alvo (até 30%)', fonte: 'motor.js:1705' },
    { id: '3072', papel: 'ad', tipo: 'sustento',    motivo: 'a cura que passa da vida máxima vira escudo (até 25%)', fonte: 'motor.js:1229' },
    { id: '3078', papel: 'ad', tipo: 'proc',        motivo: '2 cargas de Lâmina Encantada (a habilidade carrega o ataque)', fonte: 'motor.js:1672' },
    { id: '3057', papel: 'ad', tipo: 'proc',        motivo: '1 carga de Lâmina Encantada (componente da Trindade)', fonte: 'motor.js:1672' },
    { id: '3742', papel: 'ad', tipo: 'proc',        motivo: '+40 de dano no ataque a cada 4 s', fonte: 'motor.js:1698' },
    { id: '6610', papel: 'ad', tipo: 'critico',     motivo: 'o primeiro ataque em cada inimigo é crítico', fonte: 'motor.js:1699' },
    { id: '3153', papel: 'ad', tipo: 'pctVida',     motivo: '5% da vida ATUAL do alvo como dano extra (com teto em monstros gordos)', fonte: 'motor.js:1702' },
    { id: '3044', papel: 'ad', tipo: 'mobilidade',  motivo: 'Fúria: +movimento depois de atacar', fonte: 'motor.js:1706' },
    { id: '3046', papel: 'ad', tipo: 'velocidade',  motivo: '+6% de velocidade de ataque por ataque (5 acumulações)', fonte: 'motor.js:1707' },
    { id: '3085', papel: 'ad', tipo: 'area',        motivo: '2 projéteis extra (55% do dano corpo a corpo)', fonte: 'motor.js:1718' },
    { id: '6631', papel: 'ad', tipo: 'area',        motivo: '+80% do AD em TODOS os inimigos alcançados, a cada 5 s', fonte: 'motor.js:1719' },
    { id: '3074', papel: 'ad', tipo: 'area',        motivo: '40% do AD nos outros inimigos alcançados', fonte: 'motor.js:1720' },
    { id: '6333', papel: 'ad', tipo: 'anti-morte',  motivo: '30% do dano recebido vira sangramento; abater cura 15%', fonte: 'motor.js:1790, motor.js:2701' },
    { id: '3026', papel: 'ad', tipo: 'anti-morte',  motivo: 'Renascimento: volta com 50% da vida', fonte: 'motor.js:2729' },
    { id: '3053', papel: 'ad', tipo: 'anti-morte',  motivo: 'escudo de 60% da vida bónus abaixo de 30% de vida', fonte: 'motor.js:2725' },
    // ---------------- AP (a família do Rabadon) ----------------
    { id: '3089', papel: 'ap', tipo: 'multiplicador', motivo: '+35% em TODO o Poder de Habilidade (o Rabadon)', fonte: 'motor.js:522' },
    { id: '3003', papel: 'ap', tipo: 'multiplicador', motivo: '+3% da mana máxima em Poder de Habilidade', fonte: 'motor.js:521' },
    { id: '3135', papel: 'ap', tipo: 'penetracao',    motivo: '40% de penetração mágica', fonte: 'motor.js:529' },
    { id: '3100', papel: 'ap', tipo: 'proc',          motivo: '+75% do Poder de Habilidade no ataque depois de uma habilidade', fonte: 'motor.js:1688, motor.js:1944' },
    { id: '6655', papel: 'ap', tipo: 'area',          motivo: 'Eco: a cada 6 s a próxima habilidade bate em até 3 inimigos', fonte: 'motor.js:1945' },
    { id: '3102', papel: 'ap', tipo: 'anti-golpe',    motivo: 'bloqueia o próximo golpe de monstro (a cada 40 s)', fonte: 'motor.js:2698' },
    { id: '3157', papel: 'ap', tipo: 'anti-morte',    motivo: 'Stasis: invulnerável 2,5 s abaixo de 25% de vida', fonte: 'motor.js:2722' },
    // ---------------- TANQUE / NEUTRO (defensivos que o motor lê pelo ID) ----------------
    { id: '2501', papel: 'tanque', tipo: 'multiplicador', motivo: 'AD igual a 2% da vida bónus (escala com vida, não com AD)', fonte: 'motor.js:514' },
    { id: '3065', papel: 'tanque', tipo: 'cura',          motivo: '+25% em TODA a cura recebida', fonte: 'motor.js:1286' },
    { id: '3075', papel: 'tanque', tipo: 'defesa',        motivo: 'quem te ataca recebe 10 + 10% da armadura bónus', fonte: 'motor.js:1735' },
    { id: '3748', papel: 'tanque', tipo: 'area',          motivo: '+1,5% da vida MÁXIMA em todos os alcançados', fonte: 'motor.js:1721' },
    { id: '3068', papel: 'tanque', tipo: 'multiplicador', motivo: '+10% da armadura TOTAL (campo `armPct` do catálogo)', fonte: 'motor.js:523' },
    { id: '3143', papel: 'tanque', tipo: 'multiplicador', motivo: '+10% da armadura TOTAL (campo `armPct` do catálogo)', fonte: 'motor.js:523' },
    { id: '8020', papel: 'tanque', tipo: 'multiplicador', motivo: '+8% da vida MÁXIMA (campo `vidaPct` do catálogo)', fonte: 'motor.js:511' },
    { id: '6673', papel: 'ad',     tipo: 'multiplicador', motivo: '+6% da vida MÁXIMA (campo `vidaPct` do catálogo)', fonte: 'motor.js:511' },
    { id: '3170', papel: 'tanque', tipo: 'esquiva',       motivo: '+5% de esquiva (campo `esquiva` do catálogo)', fonte: 'motor.js:536' },
    { id: '3172', papel: 'ad',     tipo: 'multiplicador', motivo: '+6% do Dano de Ataque TOTAL (campo `adPct` do catálogo)', fonte: 'motor.js:523' },
  ];
  /** Campos MULTIPLICATIVOS do catálogo que o motor aplica ao TOTAL (motor.js:501 `pct`).
   *  [campo, para que papel o campo aponta]. Qualquer item com um destes entra no mapa
   *  especial SOZINHO — não há ninguém a escrevê-lo à mão. */
  const CAMPOS_MULT = [['adPct', 'ad'], ['apPct', 'ap'], ['vidaPct', 'neutro'], ['armPct', 'tanque'], ['rmPct', 'tanque'], ['esquiva', 'tanque'], ['penMag', 'ap']];   // TK-02-66: `penMag` faltava (motor.js:501/514 `pct`); `papel 'ap'` porquesó entra na mitigação MÁGICA (motor.js:542/1202)

  let _espCache = null;
  /** O MAPA ESPECIAL já resolvido para o campeão ACTUAL. Memoizado por (classe, perfil,
   *  tamanho do catálogo) — o catálogo chega por mensagem e pode entrar depois. */
  function mapaEspecial() {
    const c = META.champAtual || {};
    const minha = c.magia ? 'ap' : 'ad';
    const perfil = perfilDe(c);
    const itens = META.itens || [];
    const chave = [minha, perfil, itens.length].join('|');
    if (_espCache && _espCache.chave === chave) return _espCache.mapa;
    const mapa = new Map();
    const add = (id, papel, tipo, motivo, fonte) => {
      const k = String(id);
      const it = itens.find((x) => String(x.id) === k);
      if (!it) return;                        // fora do catálogo: a entrada NÃO existe (derivado, não inventado)
      const meu = papel === 'neutro' || papel === minha || (perfil === 'tanque' && papel === 'tanque');
      mapa.set(k, { id: k, nome: it.nome, papel, tipo, motivo, fonte, meu, raridade: it.raridade || (it.lendario ? 'lendario' : 'basico') });
    };
    for (const e of ITENS_ESPECIAIS) add(e.id, e.papel, e.tipo, e.motivo, e.fonte);
    for (const it of itens) for (const par of CAMPOS_MULT) {
      if (!it[par[0]] || mapa.has(String(it.id))) continue;
      add(it.id, par[1], 'multiplicador', par[0] + ' ' + Math.round(it[par[0]] * 100) + '% do total (campo do catálogo)', 'motor.js:501-523');
    }
    _espCache = { chave, mapa };
    return mapa;
  }
  /** Ficha especial de um item ('3089+2'/'3089~A' -> '3089'), ou null. */
  const especialDe = (base) => mapaEspecial().get(String(base == null ? '' : base).replace(/[+~].*$/, '')) || null;
  /** Item de tratamento especial DA MINHA CLASSE: NUNCA se vende e tem prioridade de slot. */
  const ehEspecialMeu = (base) => { const e = especialDe(base); return !!(e && e.meu); };
  /** Item especial da CLASSE ERRADA (Rabadon num Yasuo): não se equipa e não se protege. */
  const ehEspecialErrado = (base) => { const e = especialDe(base); return !!(e && !e.meu); };


  /** VALOR da PASSIVA (efeito) do item — parseia o texto do MOTOR (única fonte) e pontua
   *  pelo que o campeão REALMENTE usa. Ex.: Rabadon +35% AP, Liandry queima, pen mágica… */
  function valorPassiva(base, c) {
    const it = (META.itens || []).find((x) => String(x.id) === String(base));
    const e = String((it && it.efeito) || '');
    if (!e) return 0;
    // `c` EXPLÍCITO MANDA (correcção do Lead, 2026-10-14): o `montarBuildDe(c)` tem de avaliar a
    // passiva COM O CAMPEÃO QUE LHE FOI PEDIDO. MEDIDO antes: `buildIdealPara(lux)` devolvia
    // `3171,3089,4629,3100,4633` com o Yasuo em campo e `3171,3089,3135,3100,6653` com a Lux —
    // a build de um campeão mudava conforme quem estava a jogar. Sem `c`, é o campeão actual.
    const cc = c || META.champAtual || {};
    const ap = !!cc.magia, tank = c ? perfilDe(cc) === 'tanque' : perfilCampeao() === 'tanque';
    const n = (re) => { const m = e.match(re); return m ? parseFloat(String(m[1]).replace(',', '.')) : 0; };
    let v = 0;
    v += n(/Poder de Habilidade total em ([\d,]+)%/i) * 9;                    // Rabadon: +35% AP
    // PEN MÁGICA: o TEXTO só conta quando o item NÃO traz o campo `penMag` (TK-02-31). O campo
    // já é somado por `(it.penMag||0)*w.penMag` em `valorDeFase`/`poderItem`/`montarBuildDe`
    // (pesosItem: mago 700, os outros 100). Sem esta guarda o 3175 conta a pen DUAS vezes
    // (0,15×700 + 15×7 = 210 de valor). O 3135 NÃO tem campo — o motor dá os 40% por
    // `tem('3135')` (motor.js:542) — logo o texto é o ÚNICO portador e continua a contar.
    if (it.penMag == null) v += n(/([\d,]+)%\s*de penetração mágica/i) * (ap ? 7 : 1);
    if (/queimam o alvo/i.test(e)) v += ap ? 140 : 20;                        // Liandry (queima % da vida — ótimo no chefe)
    if (/menos de 40% de Vida/i.test(e)) v += ap ? 90 : 15;                   // Chama Sombria (execução)
    v += n(/próximo ataque causa \+([\d,]+)%/i) * (ap ? 2.2 : 1.2);           // Lich
    v += n(/Dano de Ataque total em ([\d,]+)%/i) * (ap ? 1 : 9);              // AD%
    // REGEX REMOVIDA (auditoria do catalogo REAL, 108 itens): `% de roubo de vida` no TEXTO tem
    // ZERO acertos — era codigo morto que parecia tratar do assunto e nao tratava. O `rv` e um
    // CAMPO do item (motor.js:254) e e pontuado pelos pesos do perfil (`w.rv`), nao por texto.
    v += n(/([\d,]+)%\s*de Velocidade de Ataque/i) * (ap ? 2 : 6);           // AS%
    if (/quem te ataca recebe/i.test(e)) v += tank ? 70 : 6;                  // Espinhos
    v += n(/Resistência Mágica total em ([\d,]+)%/i) * (tank ? 3 : 0.5);      // RM%
    v += n(/Armadura total em ([\d,]+)%/i) * (tank ? 3 : 0.5);                // Armadura%
    // ---- NORMALIZACAO DE ORDEM (auditoria de passivas 2026-10-14: 41 de 50 invisiveis) ----
    // As duas linhas acima exigem a ordem "<stat> total EM X%". MEDIDO: o jogo escreve a MESMA
    // passiva na ordem inversa em varios itens — "+15% DE Armadura total" (3174 Blindagem,
    // 3068 Fogo Solar, 3143 Pressagio), "+15% de Resistencia Magica total" (3173 Correntes).
    // Por isso 41 passivas davam valor 0 e a build era decidida so por stats brutos. Estes
    // padroes cobrem a forma alternativa SEM tocar nos que ja funcionavam (nao ha sobreposicao:
    // um exige "total em", o outro exige "% de").
    v += n(/([\d,]+)%\s*de\s*Armadura total/i) * (tank ? 3 : 0.5);            // "+X% de Armadura total"
    v += n(/([\d,]+)%\s*de\s*Resist[êe]ncia M[áa]gica total/i) * (tank ? 3 : 0.5);
    v += n(/([\d,]+)%\s*de\s*Poder de Habilidade(?!\s*total em)/i) * 9;      // "+X% de AP" (3152)
    // CDR: SÓ quando o item NÃO traz o campo `cdr` — o campo JÁ entra na soma de stats
    // (`(it.cdr||0)*w.cdr` em `valorDeFase`, `poderItem` e `montarBuildDe`).
    // CONTAGEM DUPLA MEDIDA no catálogo REAL (108 itens), apanhada pelo dono: 3171 Lucidez
    // Escarlate tem `cdr: 0.15` E o texto "−15% na recarga das habilidades" — somava
    // 0,15×w.cdr + 6×15. Já o 4629 Ímpeto Cósmico NÃO tem o campo `cdr` (só o texto): aqui o
    // texto é o ÚNICO portador do valor, logo tem de continuar a contar (senão o Ímpeto perdia
    // o CDR). A auditoria `auditoriaPassivas()` (exportada) guarda isto contra regressões.
    if (it.cdr == null) v += n(/[\u2212-]([\d,]+)%\s*na recarga/i) * 6;
    v += n(/\+([\d,]+)%\s*de esquiva/i) * 3;                                 // esquiva (3170 Passo Ligeiro)
    // ---- 2.a VAGA (mesma classe de bug, medido 2026-10-14) ----
    // A linha de AD% acima exige "Dano de Ataque total EM X%"; o jogo escreve "+6% DE Dano de
    // Ataque total" em 3172 Ritmo de Guerra, 3156 Linha da Vida e 663056 Coroa Demoníaca — os
    // tres davam 0. E "+X% de Vida máxima" (3168/3190/8020/6673) e "+X% em toda cura recebida"
    // (3065) nao existiam de todo.
    v += n(/([\d,]+)%\s*de\s*Dano de Ataque total/i) * (ap ? 1 : 9);          // "+X% de AD total"
    v += n(/\+([\d,]+)%\s*de\s*Vida m[áa]xima/i) * (tank ? 6 : 2);           // "+X% de Vida maxima"
    v += n(/\+([\d,]+)%\s*em toda cura recebida/i) * 1.5;                    // 3065 Vitalidade
    // 3031 GOLPE INFINITO: e o EQUIVALENTE AD DO RABADON (+40% de dano critico, motor.js:515
    // `danoCritico += 0.4`), tal como o Rabadon e o multiplicador de AP (motor.js:522). O
    // Rabadon estava modelado e o Golpe Infinito NAO — assimetria que empurrava a build AD
    // para longe do Gume do Infinito. Peso espelhado no do Rabadon, escalado pela classe.
    v += n(/acertos cr[íi]ticos causam \+([\d,]+)%/i) * (ap ? 3 : 12);         // 3031 Golpe Infinito
    // ---- 3.a VAGA: passivas com valor NUMERICO explicito que ficaram de fora ----
    // (as outras 19 restantes exigem ESTADO - Geada, Furia do Vento, Eco, Stasis, Renascimento -
    //  e nao se resolvem por texto: precisam de regra propria, algumas dependentes de combate)
    v += n(/([\d,]+)%\s*de penetra[çc][ãa]o de armadura/i) * (ap ? 2 : 7);     // 3036 Mata-Gigantes
    v += n(/reduz a Armadura do alvo em ([\d,]+)%/i) * (ap ? 1 : 4);          // 3071 Talhar (shred)
    v += n(/([\d,]+)%\s*da Vida atual do alvo/i) * (ap ? 3 : 5);              // 3153 Gume da Nevoa
    // ---- 4.a VAGA: as ultimas com valor numerico parseavel ----
    v += n(/ataques causam ([\d,]+)% do Dano de Ataque/i) * (ap ? 2 : 6);      // 3074 Cleave
    v += n(/([\d,]+)%\s*da sua Vida m[áa]xima/i) * (tank ? 5 : 2);            // 3748 Cleave Titanico
    v += n(/habilidades causam \+([\d,]+)% de dano/i) * (ap ? 6 : 2);          // 3165 Aflição
    v += n(/([\d,]+)%\s*da sua Mana m[áa]xima/i) * 3;                         // 3003 Pavor
    v += n(/([\d,]+)%\s*da Vida b[ôo]nus/i) * (ap ? 1 : 5);                   // 2501 Tirania
    return v;
  }
  /** PADRÕES em que o TEXTO da passiva apenas REPETE um número que o item JÁ tem em campo
   *  ESTRUTURADO **pontuado** (a pontuação soma esses campos em `valorDeFase`, `poderItem` e
   *  `montarBuildDe`: `(it.campo||0)*w.campo`). Foi assim que o dono apanhou a CONTAGEM DUPLA do
   *  CDR (2026-10-14): 3171 Lucidez Escarlate tem `cdr: 0.15` E o texto "−15% na recarga das
   *  habilidades" — somava 0,15×w.cdr + 6×15.
   *
   *  AUDITORIA DO CATÁLOGO REAL (108 itens, docs/game-src/itens.js), campo a campo:
   *    cdr     -> 3171: campo 0.15 e texto 15%  = DUPLA  (o termo do texto passou a ser
   *               condicional: `if (it.cdr == null)`);
   *               4629 Ímpeto Cósmico: SEM campo `cdr` — o texto é o ÚNICO portador, logo conta;
   *    va      -> 3046 Dançarina Fantasma: campo 0.65 e texto 6% = números DIFERENTES (é outra
   *               passiva, não o mesmo stat) -> não é dupla;
   *    rv      -> nenhum item repete o campo `rv` no texto;
   *    esquiva -> 3170 Marcha Célere: campo 0.05 e texto 5% = MESMO número, mas `esquiva` NÃO é
   *               pontuado em lado nenhum -> o texto é o único portador -> conta (não é dupla);
   *    penMag  -> 3175: idem (campo não pontuado) -> conta; 3135 não tem campo -> conta.
   *  É esta tabela que `auditoriaPassivas()` usa para acusar uma regressão futura. */
  const ECO_PONTUADO = [
    { campo: 'cdr', re: /[\u2212-]([\d,]+)%\s*na recarga/i },
  ];
  /** GUARDA CONTRA CONTAGEM DUPLA (pedido do Lead, 2026-10-14): percorre TODO o catálogo e, para
   *  cada item com passiva pontuada, mede se o valor SOBREVIVE sem os números que apenas repetem
   *  campos estruturados pontuados do próprio item. Se NÃO sobrevive, a passiva era só eco de um
   *  campo já somado = CONTAGEM DUPLA. `duplas` tem de ficar VAZIO — é a asserção do banco. */
  function auditoriaPassivas() {
    const itens = META.itens || [];
    const comPassiva = [], duplas = [];
    for (const it of itens) {
      const e = String(it.efeito || '');
      if (!e) continue;
      let v = 0; try { v = valorPassiva(it.id); } catch { v = 0; }
      if (!(v > 0)) continue;
      comPassiva.push({ id: String(it.id), nome: it.nome, valor: Math.round(v) });
      let semEco = e; const camposEco = [];
      for (const eco of ECO_PONTUADO) {
        if (it[eco.campo] == null) continue;                  // sem campo: o texto é o portador legítimo
        const m = eco.re.exec(e);
        if (!m) continue;
        const texto = parseFloat(String(m[1]).replace(/\./g, '').replace(',', '.'));
        if (Math.abs(texto - it[eco.campo] * 100) >= 0.001) continue;   // números diferentes: não é o mesmo stat
        semEco = semEco.replace(eco.re, '');                  // tira o eco e mede outra vez
        camposEco.push(eco.campo);
      }
      if (!camposEco.length) continue;                        // não havia eco nenhum
      const guardado = META.itens;
      try {
        META.itens = itens.map((x) => (String(x.id) === String(it.id) ? Object.assign({}, x, { efeito: semEco }) : x));
        const vSemEco = valorPassiva(it.id);
        if (!(vSemEco > 0)) duplas.push({ id: String(it.id), nome: it.nome, valor: Math.round(v), campos: camposEco });
      } finally { META.itens = guardado; }
    }
    return { n: itens.length, comPassiva, duplas };
  }

  /** SINERGIA (análise minha, não número do motor): o item vale mais quando combina com o que o
   *  campeão JÁ tem equipado — mesma classe de dano (o combos somam) ou completar um par. */
  function sinergiaDe(base, ctx) {
    const meus = (ctx && ctx.equipados) || [];
    if (!meus.length) return 0;
    const cl = classeItem(base);
    let s = 0;
    for (const e of meus) {
      const b = String(e);
      // BUG MEDIDO (auditoria docs/itens-ideal.md, D-botas): este +60 de INCUMBÊNCIA fazia a
      // básica EQUIPADA ganhar da épica na mochila — 1001 Botas = 60,95 contra 3047
      // Galvanizadas = 2,25. Resultado: a épica NUNCA entrava no alvo e ficava parada, contra
      // a regra do dono ("item epico e melhor q item basico").
      // Removido. O desempate entre instâncias do MESMO base continua a ser feito por `tierDe`.
      // O `if (b === String(base)) s += 60;` foi REMOVIDO (era o bónus de incumbência que
      // fazia a básica equipada ganhar da épica na mochila). O encadeamento if/else-if
      // seguinte tem de continuar intacto — daí a linha abaixo começar por `if`.
      if (cl !== 'neutro' && classeItem(b) === cl) s += 45;       // dois itens da mesma classe de dano
      // (linha movida para cima, como `if`, ao remover o bónus de incumbência)
    }
    return s;
  }

  /** VALOR DE DECISÃO do item para o campeão ATUAL = a MATEMÁTICA dos status (pesos do perfil)
   *  + a PASSIVA lida do motor + a SINERGIA com a build. NUNCA o `poder` do jogo, NUNCA
   *  qualidade/refino como multiplicador — isso é número do motor, não medida. (REGRA DO DONO:
   *  "nao poder, nunca".) `poderItem` ficou só como exibição legada no snapshot. */
  function valorDe(base, ctx) { return valorDeFase(base, ctx, null); }
  /** A MESMA conta do `valorDe`, mas com os PESOS DA FASE (mob × chefe). `fase` null/ausente =
   *  exactamente o `valorDe` de sempre (mesma ordem de operações: nenhum teste muda de número). */
  function valorDeFase(base, ctx, fase) {
    const it = (META.itens || []).find((x) => String(x.id) === String(base));
    if (!it) return 0;
    const c = META.champAtual || {};
    const perfil = perfilDe(c);
    const w = fase ? pesosItemFase(perfil, fase) : pesosItem(perfil);
    const stats = (it.ad || 0) * w.ad + (it.ap || 0) * w.ap + (it.va || 0) * w.va + (it.critico || 0) * w.critico + (it.rv || 0) * w.rv
      + (it.vida || 0) * w.vida + (it.armadura || 0) * w.armadura + (it.rm || 0) * w.rm
      + (it.cdr || 0) * w.cdr + (it.penMag || 0) * w.penMag + (it.mana || 0) * w.mana + (it.regen || 0) * w.regen;
    const ofensivo = (it.ad || 0) + (it.ap || 0) + (it.va || 0) + (it.critico || 0) + (it.rv || 0) + (it.cdr || 0) + (it.penMag || 0);
    const multDef = (perfil !== 'tanque' && ofensivo === 0) ? 0.3 : 1;
    const cl = classeItem(base);
    const multClasse = cl === 'neutro' ? 1 : (cl === (c.magia ? 'ap' : 'ad') ? 1 : pesoClasseOposta());
    // TERMO DE RARIDADE (regra do dono: "EPICO e MELHOR que BASICO"). Isto era a peça que
    // FALTAVA: sem ele o Tiamat (épico, 215,00) empatava com a Adaga/Picareta (básicos, 215,00)
    // e PERDIA no desempate por `base` (docs/itens-ideal.md §4.3, D8/D14). O degrau usa a
    // MESMA escala do motor — `QUALIDADES.mult` (motor.js:173) multiplica os stats e a
    // raridade é o degrau acima (`raridade`, motor.js:47).
    // 30% por degrau: NÃO chega para virar uma classe errada (o `multClasse` de 0,12 é 8x
    // maior) e chega para o épico da minha classe ganhar do básico da minha classe.
    const multRar = 1 + 0.30 * rarIdx(rarDe(base));
    // TERMO ESPECIAL (ver ITENS_ESPECIAIS): um item especial DA MINHA CLASSE ganha prioridade
    // de slot; um especial da CLASSE ERRADA (Rabadon num Yasuo) vale quase nada.
    const multEsp = !especialDe(base) ? 1 : (ehEspecialMeu(base) ? 1.25 : 0.10);
    // BUG MEDIDO (apanhado ao validar contra o catálogo REAL): o `valorPassiva` estava FORA
    // do multiplicador de classe, e por isso o Rabadon ("Poder de Habilidade total em 35%" ->
    // +315 de valor) valia 317 num Yasuo AD e ENTRAVA no conjunto-alvo. Um item da classe
    // errada não vale NADA: o multiplicador tem de cobrir stats + passiva + sinergia.
    const v = (stats * multDef + valorPassiva(base) + sinergiaDe(base, ctx)) * multClasse * multRar * multEsp;
    // BÓNUS DE FASE (só quando ligado): item que o motor lê PELO ID para mudar a regra
    // (ex.: 3036 = +15% de dano contra CHEFES, motor.js:1214). Sem fase, é exactamente 1.
    const bonus = fase ? bonusItemFase(base, fase) : 1;
    return bonus === 1 ? v : v * bonus;
  }
  /** raridade do catálogo (motor.js:47 `raridade`); null quando o item não existe. */
  function rarDe(base) {
    const it = (META.itens || []).find((x) => String(x.id) === String(base));
    return it ? (it.raridade || (it.lendario ? 'lendario' : 'basico')) : null;
  }


  /** Espaço do item ('botas' | 'arma' | ...) — motor.js:33 `espacoDe`. O campo SÓ serve para
   *  achar a bota: motor.js:30 "1 espaço só de bota e 4 livres; o tipo só serve para achar a bota". */
  function espacoDoItem(base) {
    const it = (META.itens || []).find((x) => String(x.id) === String(base));
    return it ? it.espaco : null;
  }
  /** COMPARADOR DE EQUIPAMENTO — a REGRA DURA de raridade da regra do dono:
   *  "EPICO e MELHOR que BASICO -> um epico equipavel NUNCA pode ficar na mochila com um
   *  basico equipado". Portanto: um BÁSICO nunca ganha de um ÉPICO/LENDÁRIO, e isso vem
   *  ANTES de qualquer valor e ANTES de qualquer histerese. Dentro do mesmo degrau (e entre
   *  épico e lendário, onde o dono não fixou ordem) manda o `valorDe`; o desempate final é
   *  determinístico pelo `base` (para a barra de equipamento nunca oscilar).
   *  FONTE DA REGRA NO MOTOR: motor.js:2878-2891 (`equipar`/`cabeNoEquip`) só restringe
   *  1 bota + 4 itens + lendário único; a raridade é degrau do catálogo (motor.js:47). */
  /** O campeão CONSEGUE usar este item? (classe de dano certa ou item neutro). Um item da
   *  classe ERRADA leva `multClasse` 0,12 no `valorDe` (automation.js `pesoClasse`) — o motor
   *  também o trata assim: `classeItem` (motor.js:22) separa quem usa ad/crit/va/rv de quem usa ap. */
  function ehUsavelPeloCampeao(base) {
    const cl = classeItem(base);
    if (cl === 'neutro') return true;
    const c = META.champAtual || {};
    return cl === (c.magia ? 'ap' : 'ad');
  }
  function cmpEquip(a, b, ctx) {
    const rarA = rarIdx(rarDe(a.base)), rarB = rarIdx(rarDe(b.base));
    const basA = rarA === 0, basB = rarB === 0;
    // A RESTRIÇÃO DURA só vale entre itens que o campeão PODE usar: senão um LENDÁRIO da classe
    // errada (Rabadon num Yasuo, valorDe 8) ganhava de uma CAPA básica da classe certa (60) só
    // por ser "de degrau superior" — o que não é o que o dono pediu. Fora desse caso, manda o
    // `valorDe` (que já tem o termo de raridade lá dentro).
    if (basA !== basB && ehUsavelPeloCampeao(a.base) && ehUsavelPeloCampeao(b.base)) return basA ? 1 : -1;
    return (valorDe(b.base, ctx) - valorDe(a.base, ctx)) || (String(a.base) < String(b.base) ? -1 : 1);
  }
  /** O MESMO comparador, com os pesos da FASE (mob × chefe). `fase` null = `cmpEquip` de sempre.
   *  A RESTRIÇÃO DURA de raridade continua a vir PRIMEIRO (é regra do dono, não peso). */
  function cmpEquipFase(a, b, ctx, fase) {
    if (!fase) return cmpEquip(a, b, ctx);
    const rarA = rarIdx(rarDe(a.base)), rarB = rarIdx(rarDe(b.base));
    const basA = rarA === 0, basB = rarB === 0;
    if (basA !== basB && ehUsavelPeloCampeao(a.base) && ehUsavelPeloCampeao(b.base)) return basA ? 1 : -1;
    return (valorDeFase(b.base, ctx, fase) - valorDeFase(a.base, ctx, fase)) || (String(a.base) < String(b.base) ? -1 : 1);
  }
  /** ESCOLHE O CONJUNTO (1 BOTA + até 4) de um POOL — a MESMA regra para o alvo de agora, para o
   *  alvo das 4 fontes e para a build teórica. Regra do motor: motor.js:29 `ESPACOS_ITENS = 4`
   *  + motor.js:30 ("1 espaço só de bota e 4 livres; o tipo só serve para achar a bota"). */
  function escolherConjunto(pool, cmp) {
    const botas = pool.filter((i) => espacoDoItem(i.base) === 'botas').sort(cmp)[0] || null;
    const alvo = botas ? [botas] : [];
    // REPETIÇÃO DE ITEM BASE — REGRA DO MOTOR (motor.js:2902 `equipar`, 2909 `trocarItem`,
    // 2913-2914 `cabeNoEquip`): o motor só recusa repetir **LENDÁRIO**
    //   `ITENS[baseId(id)].lendario && estado.itens.some((x) => baseId(x) === baseId(id))`
    // Um item NÃO-lendário pode repetir (o motor nunca o proíbe) e a única restrição de espaço
    // é 1 bota + 4 itens (`ESPACOS_ITENS`, motor.js:36). A extensão proibia QUALQUER base
    // repetida — era MAIS restritiva que o jogo (TK-02-65). `usados` passa a contar só bases
    // LENDÁRIAS; a bota continua única pelo filtro de espaço (motor.js:2913).
    const lendUsados = new Set(botas && rarDe(botas.base) === 'lendario' ? [botas.base] : []);
    for (const i of pool.slice().sort(cmp)) {
      if (alvo.length >= 5) break;
      if (espacoDoItem(i.base) === 'botas') continue;                       // 1 bota (motor.js:2913)
      if (rarDe(i.base) === 'lendario') {
        if (lendUsados.has(i.base)) continue;                               // lendário único (motor.js:2914)
        lendUsados.add(i.base);
      }
      alvo.push(i);
    }
    return alvo;
  }
  /** MELHOR instância por BASE (qualidade → refino: motor.js:252 `infoItem` multiplica por
   *  (1 + 0,12 × refino) × qualidade — `BONUS_REFINO` motor.js:55, `QUALIDADES` motor.js:173). */
  function porMelhorBase(lista) {
    // LENDÁRIO: fica só a MELHOR instância da base — é a regra do motor (lendário único,
    // motor.js:2902/2909/2913-2914). NÃO-lendário: ficam TODAS as instâncias (o motor permite
    // repetir; quem decide quantas cabem é o `escolherConjunto`, com 1 bota + 4 itens).
    const porBase = new Map();
    const out = [];
    for (const i of lista) {
      const b = String(i.base);
      if (rarDe(b) !== 'lendario') { out.push(i); continue; }
      const c = porBase.get(b); if (!c || tierDe(i) > tierDe(c)) porBase.set(b, i);
    }
    return out.concat([...porBase.values()]);
  }
  /** CONJUNTO-ALVO do equipamento — ÚNICA fonte da verdade, partilhada pelo PLANEADOR
   *  (`planBag` -> acção EQUIPAR) e pelo ACTOR (`equiparMelhores`). Se os dois não usassem
   *  a mesma função, o planeador mandava GUARDAR o que o actor nunca equipava — foi assim
   *  que o Tiamat ficou preso na mochila (docs/itens-ideal.md D16, queixa do dono).
   *
   *  POOL = mochila + equipados (nunca descartar um equipado bom). Por BASE fica a MELHOR
   *  instância (qualidade -> refino: motor.js:252 `infoItem` multiplica por
   *  (1 + 0.12 x refino) x qualidade — `BONUS_REFINO` motor.js:55, `QUALIDADES` motor.js:173).
   *
   *  `mexe` decide se vale a pena tocar no equipamento:
   *    - falta um SLOT (entra num espaço vazio)        -> mexe
   *    - entra um item de RARIDADE SUPERIOR            -> mexe (regra dura, ignora histerese)
   *    - entra um item ESPECIAL da minha classe        -> mexe
   *    - senão, só com ganho >= `cfg.equipHisterese`   -> evita oscilar a cada tick */
  function alvoEquip(bag, fase) {
    // A FASE decide os PESOS (mob × chefe). `fase === undefined` = o motor decide sozinho pelo
    // `cfg.buildPorFase`; `null` explícito = build única (comportamento antigo, uma build só).
    const f = fase === undefined ? faseBuild() : (fase || null);
    const b = bag || (() => { try { return scanBag(); } catch { return null; } })();
    const eqAtual = readEquip();
    const bagItens = (((b && b.items) || [])).filter((i) => i.kind === 'item');
    const ctxValor = { equipados: eqAtual.map((e) => String(e.base)), fase: f };
    const pool = bagItens.concat(eqAtual.map((e) => ({ kind: 'item', base: e.base, qual: e.qual, refino: e.refino, id: e.id, equipado: true })));
    const unicos = porMelhorBase(pool);
    const cmp = (a, bb) => cmpEquipFase(a, bb, ctxValor, f);
    // 1 BOTA + até 4 QUAISQUER (motor.js:29 `ESPACOS_ITENS = 4`) — a MESMA função que escolhe o
    // alvo das 4 fontes, para o "agora" e o "alvo total" nunca usarem regras diferentes.
    const alvo = escolherConjunto(unicos, cmp);
    const alvoBase = new Set(alvo.map((i) => i.base));
    const eqBase = new Set(eqAtual.map((e) => String(e.base)));
    const entram = alvo.filter((i) => !eqBase.has(i.base) && !i.equipado);
    const saem = eqAtual.filter((e) => !alvoBase.has(String(e.base)));
    const soma = (arr) => arr.reduce((s, i) => s + valorDeFase(i.base, ctxValor, f), 0);
    const pAlvo = soma(alvo), pAtual = soma(eqAtual);
    const ganho = pAtual > 0 ? pAlvo / pAtual : Infinity;
    // RESTRIÇÃO DURA DE RARIDADE: o item que entra é de degrau superior ao do equipado que ele
    // desloca? (desloca o PIOR da mesma categoria — bota com bota, resto com resto) */
    const piorQueSai = (cat) => saem.filter((e) => (espacoDoItem(e.base) === 'botas') === cat)
      .sort((x, y) => rarIdx(rarDe(x.base)) - rarIdx(rarDe(y.base)))[0] || null;
    const trocaRaridade = entram.some((i) => {
      const sai = piorQueSai(espacoDoItem(i.base) === 'botas');
      if (!sai) return true;                                       // slot vazio: mexe sempre
      // só conta como upgrade de raridade se o item for USÁVEL por este campeão (ver cmpEquip)
      if (!ehUsavelPeloCampeao(i.base)) return false;
      return rarIdx(rarDe(i.base)) > rarIdx(rarDe(sai.base));
    });
    // DEFEITO MEDIDO (dono, 2026-10-14, verbatim: "essa merda ainda desequipava um lendario
    // MELHOR q ele, pra usar ele. nao faz nem sentido. alem da diferenca de raridade, os status
    // ja eram melhores"). O `trocaEspecial` forca a troca POR CIMA da histerese. Medido ao
    // vivo: trocou `4629/A/refino+3` por `664644/A/refino 0` — MESMA raridade, refino muito
    // pior, com ganho de apenas 0,6% (abaixo da histerese de 1.05).
    // REGRA DURA: um item so ENTRA se o seu tier (qualidade x refino, `tierDe`) NAO for
    // inferior ao do pior item que sai. Sem isto o "especial" desfazia equipamento melhor.
    const piorSaiDe = (cat) => saem.filter((e) => (espacoDoItem(e.base) === 'botas') === cat)
      .sort((x, y) => tierDe(x) - tierDe(y))[0] || null;
    const entraEmDegrade = (i) => {
      const sai = piorSaiDe(espacoDoItem(i.base) === 'botas');
      if (!sai) return false;                       // espaco vazio: nao ha degradacao
      return tierDe(i) < tierDe(sai);
    };
    const trocaEspecial = entram.some((i) => ehEspecialMeu(i.base) && !entraEmDegrade(i));
    const faltaSlot = alvo.length > eqAtual.length;
    const histerese = (cfg.equipHisterese != null ? cfg.equipHisterese : 1.05);
    const mexe = faltaSlot || trocaRaridade || trocaEspecial || ganho >= histerese;
    // ---- AS QUATRO FONTES (equipado · mochila · mercado · cofre) ----------------------------
    // O "alvo de agora" (`alvo`) só pode vestir o que está EQUIPADO ou na MOCHILA (é o que o
    // `aplicarItens` alcança). `alvoTotal` é o melhor conjunto ALCANÇÁVEL com as quatro fontes
    // e `buscar`/`faltamTotal` dizem o que ir buscar ao cofre/mercado e o que não existe em
    // lado nenhum (farmar/comprar). Sem DOM (banco de testes) fica tudo vazio e o resto da
    // função continua exactamente como era.
    let fontes = null, alvoTotal = null, buscar = [], faltamTotal = [];
    try { const q = alvoQuatroFontes(f); fontes = q.fontes; alvoTotal = q.alvoTotal; buscar = q.buscar; faltamTotal = q.faltamTotal; } catch { /* sem DOM */ }
    return { alvo, atual: eqAtual, entram, saem, pAlvo, pAtual, ganho, trocaRaridade, trocaEspecial, faltaSlot, mexe, ctxValor, histerese, fase: f, fontes, alvoTotal, buscar, faltamTotal };
  }
  /** O que o PLANEADOR precisa para marcar EQUIPAR — e só isso. SEM equipamento lido
   *  (DOM ausente, ex.: o banco de testes) devolve VAZIO: a regra do dono é "um épico
   *  equipável nunca fica na mochila COM UM BÁSICO EQUIPADO" — sem equipado não há nada a
   *  deslocar. Quem enche espaços vazios é o actor `equiparMelhores`. */
  function planoEquipar(bag) {
    const vazio = { entram: [], ids: new Set(), saem: [], alvo: [], atual: [], mexe: false, ganho: null, trocaRaridade: false, trocaEspecial: false, faltaSlot: false };
    let eq; try { eq = readEquip(); } catch { return vazio; }
    if (!eq.length) return vazio;
    let r; try { r = alvoEquip(bag); } catch { return vazio; }
    // `ids` = ids dos SLOTS que entram; `bases` = as bases correspondentes. É preciso distinguir
    // porque DUAS cópias do mesmo item têm o MESMO `id` ('1006~A') — casar só por `id` marcava
    // TODAS as cópias como EQUIPAR e nenhuma era vendida (bug apanhado na verificação).
    // OBJETIVO FIXO DO DONO (cfg.objetivoItem): o item-alvo NUNCA sai da build por
    // comparacao de poder. MEDIDO 2026-10-14: com o objetivo em Rabadon (3089, cabeca)
    // EQUIPADO, o alvoEquip queria troca-lo pela Coroa da Rainha Despedacada (664644,
    // tambem cabeca) so porque esta pontua mais em poderItem - o motor desfazia
    // exactamente o objetivo que o dono tinha acabado de definir.
    try {
      const alvoBruto = cfg && cfg.objetivoItem;
      const alvoId = alvoBruto == null ? null : (/^rabadon$/i.test(String(alvoBruto)) ? RABADON : String(alvoBruto));
      if (alvoId) {
        const byId = new Map((META.itens || []).map((i) => [String(i.id), i]));
        const equipado = new Set(eq.map((i) => String(i.base || i.id)));
        if (equipado.has(alvoId)) {
          const espaco = (byId.get(alvoId) || {}).espaco;
          r.saem = (r.saem || []).filter((i) => String(i.base || i.id) !== alvoId);
          r.entram = (r.entram || []).filter((i) => {
            const e2 = (byId.get(String(i.base || i.id)) || {}).espaco;
            return !(espaco && e2 === espaco);
          });
          r.mexe = r.entram.length > 0;
        }
      }
    } catch { /* a guarda do objetivo nunca pode quebrar o equipamento */ }
    return { ...r, ids: new Set(r.entram.map((i) => i.id)), bases: new Set(r.entram.map((i) => String(i.base))) };
  }

  /** Poder de um item PARA ESTE CAMPEÃO (stats + PASSIVA, raridade, qualidade e refino). */
  function poderItem(base, qual, refino, c) {
    const it = (META.itens || []).find((x) => String(x.id) === String(base));
    if (!it) return 0;
    const w = pesosItem(perfilCampeao(c));
    const v = (it.ad || 0) * w.ad + (it.ap || 0) * w.ap + (it.va || 0) * w.va + (it.critico || 0) * w.critico + (it.rv || 0) * w.rv
      + (it.vida || 0) * w.vida + (it.armadura || 0) * w.armadura + (it.rm || 0) * w.rm
      + (it.cdr || 0) * w.cdr + (it.penMag || 0) * w.penMag + (it.mana || 0) * w.mana + (it.regen || 0) * w.regen + valorPassiva(base, c);
    const RAR = { basico: 1, epico: 1.15, lendario: 1.35 };
    return v * pesoClasse(base) * (RAR[it.raridade] || 1) * (Q_MULT[qual] || 1) * (1 + 0.12 * (refino || 0));
  }

  /** AUTO-REFINO (Ornn): SÓ itens EQUIPADOS LENDÁRIOS tier A+ → até +3 (limite do dono).
   *  +2 é seguro; do +2 em diante há chance de regredir. Nada de item comum/épico. */
  function statsDePeca(base, qual, refino) {
    const b = String(base == null ? '' : base).replace(/[+~].*$/, '');
    const it = (META.itens || []).find((x) => String(x.id) === b);
    if (!it) return null;
    const q = (!qual || qual === '?') ? 'B' : String(qual).toUpperCase();
    const r = refino == null ? 0 : +refino;
    const m = (1 + BONUS_REFINO * r) * (QUAL_MULT[q] || 1);       // motor.js:252
    const ef = String(it.efeito || '');
    let cdr = it.cdr;
    if (cdr == null) { const mm = ef.match(/[\u2212-]\s*(\d+)\s*%\s*(?:na\s*)?recarga/i); if (mm) cdr = +mm[1] / 100; }
    let penMag = it.penMag;
    if (penMag == null) { const mm2 = ef.match(/(\d+)\s*%\s*de\s*penetra[çc][ãa]o\s*m[áa]gica/i); if (mm2) penMag = +mm2[1] / 100; }
    return {
      mult: +m.toFixed(4), qual: q, refino: r,
      ad: (it.ad || 0) * m, ap: (it.ap || 0) * m, mana: (it.mana || 0) * m, vida: (it.vida || 0) * m,
      armadura: (it.armadura || 0) * m, rm: (it.rm || 0) * m, va: (it.va || 0) * m, rv: (it.rv || 0) * m,
      critico: (it.critico || 0) * m, regen: (it.regen || 0) * m, cdr: (cdr || 0) * m,
      // FORA da lista do motor (motor.js:254-255): não escalados.
      penMag: penMag || 0, penArmadura: it.penArmadura || (b === '3036' ? 0.3 : 0),   // motor.js:539
    };
  }

  function pecaConhecida(base) {
    const b = String(base == null ? '' : base).replace(/[+~].*$/, '');
    let melhor = null;
    const ver = (id) => {
      try {
        const p = parseSlotId(id);
        if (!p.base || p.base !== b) return;
        if (!melhor || p.mult > melhor.mult) melhor = { id: String(id), qual: p.qual, refino: p.refino, mult: p.mult };
      } catch { /* ignore */ }
    };
    try { for (const e of readEquip()) ver(e.id || e.base); } catch { /* sem DOM */ }
    try { for (const i of ((scanBag() || {}).items || [])) if (i.kind === 'item') ver(i.id || i.base); } catch { /* sem DOM */ }
    return melhor;
  }

  /** Normaliza a lista de itens a farmar: aceita id OU nome, resolve pelo CATÁLOGO e tira
   *  repetidos. Era CHAMADA (linhas 5451/5470) e nunca definida — a suite `w10` rebentava. */
  function farmarItemIds(lista) {
    const arr = Array.isArray(lista) ? lista : (lista == null ? [] : [lista]);
    const out = [];
    for (const x of arr) {
      const t = String(x == null ? '' : x).trim();
      if (!t) continue;
      const it = (META.itens || []).find((y) => String(y.id) === t || String(y.nome || '').toLowerCase() === t.toLowerCase());
      const id = it ? it.id : t;
      if (!out.includes(id)) out.push(id);
    }
    return out;
  }

  /** Estado do farm de itens (usado em 4 sitios, nunca declarado — ReferenceError no banco). */
  let _farmItem = { ids: [], regiao: null, desde: 0, parou: null, destino: null };

  function farmarItemEstado() {
    const ids = _farmItem.ids.length ? _farmItem.ids : farmarItemIds(cfg.farmarItem);
    return { ativo: ids.length > 0, ids, regiao: _farmItem.regiao, desde: _farmItem.desde,
      parou: _farmItem.parou, destino: _farmItem.destino,
      tenho: ids.map((b) => ({ base: b, tenho: farmarItemTenho(b) })) };
  }

  function farmarItemParar(motivo) {
    const ids = _farmItem.ids.slice();
    _farmItem = { ids: [], regiao: null, desde: null, parou: { at: Date.now(), motivo: motivo || 'manual' }, destino: null };
    try { setConfig({ farmarItem: [], regionDefault: null }); } catch { /* ignore */ }
    try { logEvent('farm-item', { parou: ids, motivo: motivo || 'manual' }); } catch { /* ignore */ }
    return { ok: true, ids, motivo: motivo || 'manual' };
  }

  function farmarItemTenho(base) {
    const b = String(base == null ? '' : base).replace(/[+~].*$/, '');
    if (!b) return null;
    try { if (readEquip().some((e) => String(e.base) === b)) return true; } catch { /* sem DOM */ }
    try {
      const bag = scanBag();
      if (!bag) return null;
      return (bag.items || []).some((i) => i.kind === 'item' && String(i.base) === b);
    } catch { return null; }
  }

  function recomendarAtributos(c) {
    const cc = c || META.champAtual || {};
    const magia = !!cc.magia;
    let ctx = null;
    try { ctx = ctxDano(); } catch { ctx = null; }
    // dps das habilidades com um contexto alterado (mede, não teoriza)
    const dpsHabs = (patch) => {
      if (!ctx) return 0;
      const c2 = Object.assign({}, ctx, patch || {});
      let s = 0;
      try { for (const h of ((readSkills().arsenal) || [])) s += dpsRank(c2, h.t, h.rank); } catch { /* ignore */ }
      return s;
    };
    const base0 = dpsHabs({});
    const p = player();
    const autoDps = (p.dano || 0) * (p.va || 0);        // componente de auto-ataque (motor.js:1675)
    const ganho = {};
    // Força: na magia o ponto vira Poder (só as habilidades escalam com ele, motor.js:516);
    // no AD o ponto é dano de ataque — entra nas habilidades QUE escalam com dano E no auto
    // (motor.js:516 `ad += 1.2*at.forca`; o auto bate com `ad`, motor.js:1698).
    ganho.forca = magia ? (dpsHabs({ ap: (ctx && ctx.ap || 0) + 2 }) - base0)
      : (dpsHabs({ ad: (ctx && ctx.ad || 0) + 1.2 }) - base0) + 1.2 * (p.va || 0);
    ganho.agilidade = 0.008 * autoDps;                   // motor.js:461 -> 516 -> 547
    ganho.foco = base0 * (1 / Math.max(0.7, 1 - 0.004) - 1);   // motor.js:463/550 (tecto 30%)
    if (cc.semMana) ganho.foco += 0.002 * base0;          // motor.js:470-474 (Katarina/Zac)
    ganho.vitalidade = 0;                                // motor.js:457/516: não entra no dano
    ganho.resistencia = 0;                               // motor.js:459/516: não entra no dano
    const ordem = ['forca', 'agilidade', 'foco', 'vitalidade', 'resistencia'];
    return ordem.map((k) => ({ atrib: k, danoPorPonto: ganho[k], fonte:
      k === 'forca' ? (magia ? 'motor.js:467 (+2 Poder) + motor.js:516' : 'motor.js:455 (+1,2 dano) + motor.js:516')
        : k === 'agilidade' ? 'motor.js:461 (+0,8% vel. ataque) + motor.js:547'
          : k === 'foco' ? 'motor.js:463 (−0,4% recarga) + motor.js:550'
            : k === 'vitalidade' ? 'motor.js:457 (+20 vida) — sem dano'
              : 'motor.js:459 (+1,5 armadura/+1 RM) — sem dano' }))
      .sort((a, b) => b.danoPorPonto - a.danoPorPonto);
  }

  function farmarItem(ids) {
    const alvo = farmarItemIds(ids);
    if (!alvo.length) return { ok: false, motivo: 'sem itens (use farmarItem(["3089"]))' };
    // O destino vem do PLANEJADOR do motor (drops/h medidos; `planejar` le META.ondeItem).
    let destinos = [];
    try { destinos = planejar(alvo) || []; } catch { destinos = []; }
    // Prefere um destino onde o chefe NAO e fatal (o boneco farma mobs sem morrer); se todos
    // forem fatais, fica o melhor de drops/h — o `estimarRegiao`/fuga tratam do resto.
    const viaveis = destinos.filter((d) => d.chefeFatal !== true);
    const melhor = (viaveis.length ? viaveis : destinos).slice().sort((a, b) => (b.dropsH || 0) - (a.dropsH || 0))[0] || null;
    const regiao = melhor ? melhor.zona : null;
    _farmItem = { ids: alvo, regiao, desde: Date.now(), parou: null, destino: melhor || null };
    // PERSISTE na config (o mesmo caminho da GUI: `setConfig`) — o modo sobrevive ao reload.
    setConfig({ farmarItem: alvo, regionDefault: regiao || cfg.regionDefault });
    if (regiao) { try { viajarPara(regiao); } catch { /* sem mapa/DOM */ } }
    try { logEvent('farm-item', { ligou: alvo, regiao, zonaNome: melhor ? melhor.zonaNome : null, dropsH: melhor ? melhor.dropsH : null }); } catch { /* ignore */ }
    return { ok: true, ids: alvo, regiao, destino: melhor, viajou: !!regiao, motivo: regiao ? null : 'o motor nao sabe onde estes itens dropam (catalogo incompleto?)' };
  }

  function farmarItemPasso() {
    const ids = _farmItem.ids.length ? _farmItem.ids : farmarItemIds(cfg.farmarItem);
    if (!ids.length) return { ativo: false };
    if (!_farmItem.ids.length) _farmItem = { ids, regiao: cfg.regionDefault || null, desde: _farmItem.desde || Date.now(), parou: null, destino: null };
    const caiu = ids.filter((b) => farmarItemTenho(b) === true);
    if (caiu.length) {
      // CAIU: para o modo e devolve a regiao ao motor (o `regionDefault: null` faz o
      // `regiaoIdeal` voltar a escolher sozinho). Isto e a PARAGEM que faltava.
      const r = farmarItemParar('item caiu: ' + caiu.join(', '));
      return { ativo: false, parou: true, caiu, ids, motivo: r.motivo };
    }
    return { ativo: true, ids, regiao: _farmItem.regiao, desde: _farmItem.desde, tenho: null };
  }

  function migrarCfg(s) {
    if (!s) return { cfg: null, migrou: [], cfgVer: CFG_VER };
    const ver = Number.isFinite(+s.cfgVer) ? +s.cfgVer : 0;   // sem campo = config de antes da migração
    const a = { ...(s.automation || {}) };
    const migrou = [];
    for (const m of MIGRACOES_CFG) {
      if (ver >= m.ver) continue;                                   // já migrado nesta ou em versão anterior
      if (!Object.prototype.hasOwnProperty.call(a, m.chave)) continue;   // chave nova: o DEFAULT já a traz
      if (a[m.chave] !== m.de) continue;                           // valor do DONO (≠ default velho) → intocável
      a[m.chave] = m.para;
      migrou.push({ chave: m.chave, de: m.de, para: m.para, ver: m.ver });
    }
    return { cfg: a, migrou, cfgVer: CFG_VER };
  }

  // Estado do consumidor de eventos do inject.js (TK-INT-01) — estavam USADOS e nunca
  // declarados: a suite `integracao` rebentava com `_eventosCont is not defined`.
  let _estadoVivo = null;
  let _eventosVivos = [];
  let _eventosCont = {};

  function consumirEvento(d) {
    try {
      const tipo = String((d && d.tipo) || '').trim();
      if (!tipo) return;
      _eventosCont[tipo] = (_eventosCont[tipo] || 0) + 1;
      _eventosVivos.unshift({ tipo, t: d.t != null ? d.t : null, at: d.at || Date.now(), payload: d });
      if (_eventosVivos.length > 100) _eventosVivos.pop();
      const c = farm && farm.current;
      if (tipo === 'abate') {
        // motor.js:1807 — ouro/xp/itens EXACTOS do abate (a UI arredonda; o evento não).
        const ouro = Number(d.ouro), xp = Number(d.xp);
        if (c) {
          c.abatesEvento = (c.abatesEvento || 0) + 1;
          c.ouroEvento = (c.ouroEvento || 0) + (Number.isFinite(ouro) ? ouro : 0);
          c.xpEvento = (c.xpEvento || 0) + (Number.isFinite(xp) ? xp : 0);
          const fase = c.fase === 'boss' ? c.bossFase : c.mobFase;
          if (fase) { fase.abatesEvento = (fase.abatesEvento || 0) + 1; }
        }
        logEvent('evento:abate', { nome: d.nome || null, ouro: Number.isFinite(ouro) ? ouro : null, xp: Number.isFinite(xp) ? xp : null, chefe: !!d.chefe, furioso: !!d.furioso, itens: (d.itens || []).length, gemas: (d.gemas || []).length });
        return;
      }
      if (tipo === 'chefeInvoca') {           // motor.js:3142 — as 2 larvas do Barão
        if (c) { c.chefeInvoca = (c.chefeInvoca || 0) + 1; }
        // TK-02-148: as 2 larvas (motor.js:3141-3142) CONTAM para a Voracidade (motor.js:1811, sem
        // guarda `i.invocado`) e NAO dao loot (motor.js:1792) — nao passam pelo log, entram aqui.
        try { _larvasInvoca.push({ at: d.at || Date.now(), n: 2 }); if (_larvasInvoca.length > 60) _larvasInvoca.shift(); } catch { /* ignore */ }
        logEvent('evento:chefeInvoca', { alvo: d.alvo != null ? d.alvo : null, chefe: c && c.boss ? c.boss : null });
        return;
      }
      if (tipo === 'chefeCarrega' || tipo === 'chefeGolpe' || tipo === 'chefeInterrompido') {
        if (c) { c[tipo] = (c[tipo] || 0) + 1; }
        logEvent('evento:' + tipo, { alvo: d.alvo != null ? d.alvo : null, mec: d.mec || null, dur: d.dur != null ? d.dur : null, bloqueado: !!d.bloqueado });
        return;
      }
      if (tipo === 'buffBarao') { if (c) { c.buffBarao = (c.buffBarao || 0) + 1; } logEvent('evento:buffBarao', {}); return; }
      if (tipo === 'nivel') { logEvent('evento:nivel', { nivel: d.nivel != null ? d.nivel : null }); return; }
      if (tipo === 'morreu') {
        if (c) { c.deaths = (c.deaths || 0) + 1; }
        logEvent('evento:morreu', { por: d.por || d.alvo || null });
        return;
      }
      if (tipo === 'item') { if (c) { c.itensEvento = (c.itensEvento || 0) + 1; } logEvent('evento:item', { id: d.id || null }); return; }
      if (tipo === 'pocao') { logEvent('evento:pocao', { tipo: d.pocao || d.tipo2 || null }); return; }
      if (tipo === 'semPocao') { logEvent('evento:semPocao', {}); return; }
      // os restantes (recall, grupo, kite, fluxo, luden, bravata, divisao, abateRoubado,
      // recallCancelado...) ficam nos contadores + buffer: já não morrem silenciosamente.
      logEvent('evento:' + tipo, { resumo: Object.keys(d).filter((k) => k !== '__lolidleAuto' && k !== 'tipo').slice(0, 6) });
    } catch { /* um evento nunca pode derrubar o motor */ }
  }

  function estadoVivo() { return _estadoVivo; }

  function eventosVivos() { return _eventosVivos.slice(); }

  function eventosContadores() { return Object.assign({}, _eventosCont); }

  function nivelAlvo(local, papel, nivelJogador) {
    if (!local) return null;
    const nm = local.nm || local.faixa || null;
    if (!nm) return null;
    const n0 = +nm[0] || 1, n1 = nm[1] != null ? +nm[1] : n0;
    // `nivelJogador === null` (explicito) = o ramo `nivelJogador == null` do MOTOR: sem jogador
    // lido, o chefe nasce no topo da faixa + 2 e o mob sai uniforme na faixa. `undefined`
    // (argumento ausente) continua a usar o jogador lido do HUD, como a extensao sempre fez.
    const p = (nivelJogador === undefined) ? (player() || {}).nivel : nivelJogador;
    const semJog = (p == null || !(p > 0));
    if (papel === 'chefe') return semJog ? n1 + 2 : Math.max(n0 + 2, Math.min(n1 + 2, p + 4));
    // MOB: clamp(P-2+rand(0..3), n0, n1) -> media P-0,5 (motor.js:1132)
    return semJog ? (n0 + n1) / 2 : Math.max(n0, Math.min(n1, p - 0.5));
  }

  const nivelMobDe = (local, nivelJogador) => nivelAlvo(local, 'mob', nivelJogador);

  /** Stats de um monstro/chefe num nível (do motor). */
  function statsMonstro(nome, nivel) {
    const m = META.monstros?.[nome];
    if (!m) return null;
    const c = curva(nivel);
    return { nome, nivel, hp: c.hp * m.hp, ad: c.ad * m.ad, as: m.as, armadura: c.armadura * m.armadura, xp: c.xp * m.xp, ouro: c.ouro * m.ouro * 0.75, chefe: !!m.chefe, magico: !!m.magico };
  }

  const mediaWaveDe = (g) => {
    if (!g || g.base == null) return 3;                      // motor.js:1137 (valor esperado)
    if (g.rand == null || !(g.rand > 1)) return g.base;      // sem variacao: a base e a media
    return g.base + (g.rand - 1) / 2;
  };

  async function refinarMelhores() {
    if (!naBase()) return { ok: false, motivo: 'so na Fonte' };
    // M6 — REGRA DO DONO: "ao conseguir um dos itens ESSENCIAIS, tier A ou mais, pode
    // refinar até mais 2 ou 3". Antes refinava QUALQUER lendário A+ equipado; agora só
    // os que pertencem à build ideal do campeão (`buildIdeal()` é champion-aware — para
    // o Yasuo devolve a build AD, não a AP). O refino do +2 em diante é irreversível,
    // por isso o alvo tem de ser o item que a build realmente quer.
    // AUTORIDADE DA LISTA — resolvido por DADO, não por palpite: se já houver histórico
    // medido suficiente, a lista de essenciais é a build que MEDIU melhor (mesmo princípio
    // que o `melhorSet` no contexto 'mob': o empírico manda). Só quando não há amostra
    // suficiente é que se cai na `buildIdeal()` teórica. Sem isto, o gate do M6 recusava
    // refinar a build que ganhou o M1 só porque ela difere da lista teórica.
    let essenciais = [];
    let fonteEssenciais = 'teorico';
    try {
      const rank = (rankBuildsTestadas(null) || []).filter((r) => r.mob && r.mob.goldMin != null && ((r.confianca && r.confianca.mob) || 0) >= 3);
      if (rank.length) {
        rank.sort((a, b) => (b.mob.goldMin || 0) - (a.mob.goldMin || 0));
        essenciais = (rank[0].itens || []).map(String);
        fonteEssenciais = 'medido(n=' + ((rank[0].confianca && rank[0].confianca.mob) || 0) + ', ' + Math.round(rank[0].mob.goldMin) + ' ouro/min)';
      }
    } catch { /* ignore */ }
    if (!essenciais.length) { try { essenciais = (buildIdeal() || []).map(String); } catch { essenciais = []; } }
    // R0/R1/R2 (refinar.test.mjs): a MEDICAO a validar vem do RANK das rodadas de teste salvas
    // (com `mob.goldMin`), NAO do `agregar()` - senao havia 'medicao' onde nao ha e o R0 falhava.
    let medido = null, divergenciaMedido = [];
    try {
      const rk = (rankBuildsTestadas(null) || []).filter((x) => x && x.mob && x.mob.goldMin != null)
        .sort((x, y) => (y.mob.goldMin || 0) - (x.mob.goldMin || 0));
      if (rk.length) {
        const m0 = rk[0]; const itensM = (m0.itens || []).map(String);
        const nM = (m0.confianca && m0.confianca.mob) || itensM.length;
        if (nM >= 3) {
          medido = { n: nM, ouroMin: m0.mob.goldMin, xpMin: m0.mob.xpMin, itens: itensM };
          const teorM = (() => { try { return (buildIdeal() || []).map(String); } catch { return []; } })();
          divergenciaMedido = itensM.filter((id) => teorM.indexOf(id) < 0);
        }
      }
    } catch { /* sem medicao */ }
    const alvos = readEquip().filter((e) => {
      const it = (META.itens || []).find((x) => String(x.id) === e.base);
      // TETO DE REFINO — mecanica MEDIDA no texto do próprio Ornn:
      //   "O +1 e o +2 saem fácil e nunca dão errado de verdade; da tentativa de +3 em
      //    diante, a chance cai e falhar pode fazer o item VOLTAR UM NÍVEL."
      // Logo tentar o +3 é o primeiro passo com risco de REBAIXAR. O dono autorizou
      // "até mais 2 ou mais 3", mas como a falha é irreversível e pode perder refino,
      // o padrão é PARAR NO +2 (seguro) e o +3 fica disponível por config explícita
      // (`cfg.refinoMax`), nunca por omissão.
      const refinoMax = (cfg.refinoMax != null ? cfg.refinoMax : 2);
      if (!it || it.raridade !== 'lendario' || qIdx(e.qual) < qIdx('A') || (e.refino || 0) >= refinoMax || e.base === RABADON) return false;
      return essenciais.includes(String(e.base));
    });
    // OBSERVABILIDADE: TODAS as saidas (inclusive as de falha) levam o diagnostico.
    const diag = { alvos: alvos.map((a) => a.base), essenciais, fonteEssenciais, medido, divergenciaMedido };
    // O DIAG TEM DE SAIR: sem `...diag` o `medido`/`divergenciaMedido` nunca chegavam ao teste (e a
    // observabilidade que o dono pede ficava a zero). Era o defeito do R0/R2 do refinar.test.mjs.
    if (!alvos.length) return { ok: true, refinados: [], motivo: 'nenhum item ESSENCIAL da build, LENDARIO A+ abaixo de +' + ((cfg.refinoMax != null ? cfg.refinoMax : 2)), ...diag };
    fecharJanelas(); await humano(300);
    // os ALVOS e a lista de essenciais viajam em TODOS os retornos: quem chamou tem de ver
    // O QUE ia ser refinado e PORQUÊ, mesmo quando o passo falha (é o log do dono).
    if (!clickNPC('Ornn')) return { ok: false, motivo: 'sem Ornn', ...diag };
    const bt = await waitFor('#janela-npc [data-palavra="forjar"]', 4000);
    if (!bt) return { ok: false, motivo: 'sem opcao forjar', ...diag };
    bt.click(); await humano(650);
    const feitos = [];
    for (const e of alvos) {
      const slots = [...document.querySelectorAll('[data-pegar^="itens:"]')];
      const s = slots.find((x) => (x.querySelector('img')?.getAttribute('src') || '').includes('/' + e.base + '.'));
      if (!s) continue;
      s.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));    // 2 cliques = vai pra bigorna
      await humano(550);
      const onde = s.dataset.pegar;
      const fj = document.querySelector(`[data-forjar="${onde}"][data-vezes="1"]`) || document.querySelector(`[data-forjar="${onde}"]`);
      if (!fj) { fecharJanelas(); continue; }
      fj.click(); await esperar(1500);                                    // animação da forja
      clicarDialogo(/^(forjar|sim|ok|entendi)$/i); await esperar(500);
      const agora = readEquip().find((x) => x.base === e.base);
      feitos.push({ base: e.base, de: e.refino || 0, para: agora ? (agora.refino || 0) : null });
    }
    fecharJanelas();
    logEvent('refino', { feitos });
    return { ok: true, refinados: feitos, ...diag };
  }

  /** MONTAGEM AUTÓNOMA — escolhe e monta sozinha a receita que serve a build.
   *  Fecha o ciclo que faltava: a extensão farmava ouro mas NUNCA o gastava a melhorar a
   *  própria build; o `montarItem` existia e não era chamado por ninguém. Aqui:
   *    - só na Fonte, no máximo 1x/30 min (é uma aposta, não spam);
   *    - respeita reserva de 20.000 (nunca zera o ouro);
   *    - só receitas cujos componentes EXISTEM (`pode`) e que sirvam a build ideal;
   *    - escolhe a mais BARATA (custo esperado = ouro/tentativa x tentativas médias). */
  let _ultimaMontagem = 0, _ultimoRefino = 0;
  async function montarMelhorReceita() {
    if (!naBase()) return { ok: false, motivo: 'so na Fonte' };
    const disponivel = readGold() - 20000;
    if (disponivel < 40000) return { ok: false, motivo: 'ouro insuficiente (disponivel ' + disponivel + ')' };
    const rec = await receitasOrnn();
    if (!rec || !rec.ok) return { ok: false, motivo: (rec && rec.motivo) || 'sem receitas' };
    let ideal = []; try { ideal = (buildIdeal() || []).map(String); } catch { ideal = []; }
    const comps = componentesDaBuild();
    const num = (s) => parseInt(String(s || '').replace(/\D/g, ''), 10) || 0;
    const cands = (rec.receitas || [])
      .filter((r) => r.pode && (comps.has(String(r.id)) || ideal.indexOf(String(r.id)) >= 0))
      .map((r) => ({ id: r.id, nome: r.nome, ouro: num(r.ouro), tent: r.tentativasMedias || 83, custo: num(r.ouro) * (r.tentativasMedias || 83) }))
      .filter((r) => r.custo > 0 && r.custo <= disponivel)
      .sort((a, b) => a.custo - b.custo);
    if (!cands.length) return { ok: true, motivo: 'nada montavel dentro do ouro', disponivel };
    const alvo = cands[0];
    const vezes = Math.max(10, Math.min(1000, Math.ceil((alvo.tent * 1.2) / 10) * 10));
    _ultimaMontagem = Date.now();
    logEvent('montagem', { alvo: alvo.id, nome: alvo.nome, custoPrevisto: alvo.custo, vezes, disponivel });
    const res = await montarItem(alvo.id, vezes, 'arcana');
    return { ok: !!(res && res.ok), alvo: alvo.id, nome: alvo.nome, custoPrevisto: alvo.custo, vezes, ...(res || {}) };
  }

  /** RECEITAS DO ORNN (LEITURA, não gasta ouro). Lista o que ele pode montar e se
   *  há componentes na mochila — é o que permite decidir a montagem por DADO em vez
   *  de tentar às cegas (a bancada é uma aposta a 1,2%/tentativa; ver HANDOFF §9.6f).
   *  Seletores MEDIDOS na bancada real:
   *    .troca-linha.montagem · button[data-receita] · img.comp (dica traz "Você tem")
   *    span.ouro (custo) · span.chance-montar (chance + "Em média: N tentativas") */
  async function receitasOrnn(filtro) {
    if (!naBase()) return { ok: false, motivo: 'so na Fonte' };
    fecharJanelas(); await humano(300);
    if (!clickNPC('Ornn')) return { ok: false, motivo: 'sem Ornn' };
    const bt = await waitFor('#janela-npc [data-palavra="montar"]', 4000);
    if (!bt) return { ok: false, motivo: 'sem opcao montar' };
    bt.click(); await humano(700);
    const linhas = [...document.querySelectorAll('#janela-npc .troca-linha.montagem')];
    const out = linhas.map((l) => {
      const btn = l.querySelector('button[data-receita]');
      const id = btn ? btn.dataset.receita : null;
      const nome = ((l.querySelector('.info b') || {}).textContent || '').trim();
      const chance = ((l.querySelector('.chance-montar') || {}).textContent || '').trim();
      const chanceDica = ((l.querySelector('.chance-montar') || {}).dataset || {}).dica || '';
      const media = (chanceDica.match(/média:\s*(\d+)/i) || [])[1] || null;
      const comps = [...l.querySelectorAll('img.comp')].map((c) => { const d = c.dataset.dica || ''; return { nome: (d.split('\n')[0] || '').trim(), tem: /Você tem/.test(d) }; });
      const ouro = ((l.querySelector('span.ouro') || {}).textContent || '').trim();
      return { id, nome, chance, tentativasMedias: media ? +media : null, ouro, comps, pode: comps.length > 0 && comps.every((c) => c.tem) };
    }).filter((r) => r.id);
    fecharJanelas();
    const res = filtro ? out.filter((r) => (r.nome || '').toLowerCase().includes(String(filtro).toLowerCase()) || String(r.id) === String(filtro)) : out;
    logEvent('ornn', { receitas: res.length, montaveis: res.filter((r) => r.pode).length });
    return { ok: true, total: out.length, receitas: res };
  }

  /** MONTA um item na bancada do Ornn. E uma APOSTA (1,2%/tentativa; com a Runa
   *  Arcana 2,4%): as pecas so sao consumidas no SUCESSO, o custo e o ouro por tentativa.
   *  Todos os seletores foram MEDIDOS na bancada real (HANDOFF 9.6l/9.6m):
   *    button[data-receita] - SPAN.forja-pegar (sem .nao-serve) - [data-usarGema] -
   *    [data-montar="<id>"][data-vezes] (1/10/100/1000).
   *  `vezes` usa os botoes de LOTE - numa aposta de 83 tentativas medias nao se clica 83 vezes. */
  async function montarItem(id, vezes, gema) {
    if (!naBase()) return { ok: false, motivo: 'so na Fonte' };
    const n = Math.max(1, Math.min(1000, Number(vezes) || 1));
    const antes = readGold();
    fecharJanelas(); await humano(300);
    if (!clickNPC('Ornn')) return { ok: false, motivo: 'sem Ornn' };
    const bt = await waitFor('#janela-npc [data-palavra="montar"]', 4000);
    if (!bt) return { ok: false, motivo: 'sem opcao montar' };
    bt.click(); await humano(700);
    const rec = document.querySelector('#janela-npc button[data-receita="' + id + '"]');
    if (!rec) { fecharJanelas(); return { ok: false, motivo: 'sem receita ' + id }; }
    rec.click(); await humano(700);
    if (gema) { const g = document.querySelector('#janela-npc [data-usarGema="' + gema + '"]'); if (g) { g.click(); await humano(350); } }
    // DIAGNOSTICO MEDIDO (jogo.js:5325): o handler de dois cliques esta em #npc-troca e faz
    //   if (montarSel && $('#npc-troca [data-slot]')) porNoSlot(p.dataset.pegar, null);
    // A receita tem N SLOTS (Tiamat = 2) mas havia 5 pecas que servem -> colocar as 5 numa
    // receita de 2 slots deixa o botao desactivado. Poe-se EXACTAMENTE o numero de slots.
    const slots = document.querySelectorAll('#npc-troca [data-slot]').length || 0;
    const servem = [...document.querySelectorAll('#janela-npc SPAN.forja-pegar')].filter((s) => !s.classList.contains('nao-serve'));
    if (!servem.length) { fecharJanelas(); return { ok: false, motivo: 'sem pecas que sirvam (bancada vazia)' }; }
    // BUG CORRIGIDO (apanhado pelo auto-diagnóstico: slots=2 mas naBancada=1): eu guardava
    // as peças numa lista e clicava-as em sequência, mas depois do 1.º clique o jogo
    // REDESENHA a bancada e a referência guardada para a 2.ª peça fica ÓRFÃ — o dblclick
    // não faz nada. Agora volta a procurar a cada iteração (e ignora as já colocadas).
    for (let k = 0; k < (slots > 0 ? slots : 1); k++) {
      // CAUSA ENCONTRADA POR INSTRUMENTAÇÃO (§9.6s): depois da 1.ª peça entrar, o SLOT da
      // bancada cria o SEU PRÓPRIO `SPAN.forja-pegar` com `data-pegar="undefined"` — e vem
      // PRIMEIRO na ordem do DOM. O filtro antigo (só `!nao-serve && !na-bigorna`) apanhava
      // esse fantasma e o 2.º dblclick ia para o vazio (`porNoSlot(undefined,null)`), por isso
      // só 1 peça entrava. Agora exige-se um `data-pegar` VÁLIDO (`onde:k`).
      const s = [...document.querySelectorAll('#janela-npc SPAN.forja-pegar')]
        .filter((x) => {
          const r = x.dataset.pegar || '';
          return r.indexOf(':') > 0 && !x.classList.contains('nao-serve') && !x.classList.contains('na-bigorna');
        })[0];
      if (!s) break;
      s.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
      await humano(340);
    }
    await humano(300);
    // as pecas que ficaram na bancada (o handler marca-as); se nenhuma entrou, nao gasta ouro
    const naBancada = document.querySelectorAll('#npc-troca .montar-slot.cheio').length;
    if (slots > 0 && naBancada === 0) { fecharJanelas(); return { ok: false, motivo: 'nenhuma peca entrou na bancada (slots=' + slots + ', servem=' + servem.length + ')' }; }
    await humano(400);
    const botoes = [...document.querySelectorAll('#janela-npc [data-montar="' + id + '"]')];
    let alvo = botoes.find((b) => String(b.dataset.vezes) === String(n));
    if (!alvo) { const ord = botoes.map((b) => ({ b, v: Number(b.dataset.vezes) || 1 })).sort((a, c) => a.v - c.v); alvo = (ord.filter((x) => x.v <= n).pop() || ord[0] || {}).b; }
    if (!alvo) { fecharJanelas(); return { ok: false, motivo: 'sem botao de montar', slots, servemN: servem.length, naBancada }; }
    // FALHA AUTO-DIAGNOSTICADA: devolve os números que explicam o porquê, em vez de só
    // 'desactivado'. Se `slots` for 0, a receita NÃO ficou seleccionada (montarSel); se
    // `naBancada` for 0, as peças não entraram; se ambos >0, o botão é que não aceita.
    if (alvo.disabled) { fecharJanelas(); return { ok: false, motivo: 'botao desactivado (pecas nao aceites)', slots, servemN: servem.length, naBancada, receitaSel: !!document.querySelector('#npc-troca [data-slot]') }; }
    const usadas = Number(alvo.dataset.vezes) || 1;
    alvo.click();
    await esperar(1200);
    clicarDialogo(/^(montar|sim|ok|entendi)$/i);
    await esperar(900);
    const depois = readGold();
    const ganho = (() => { try { return scanBag(true).items.filter((i) => i.kind === 'item' && i.base === String(id)).length; } catch { return null; } })();
    fecharJanelas();
    const res = { ok: true, id: String(id), vezesPedidas: n, vezesUsadas: usadas, gema: gema || null, ouroAntes: antes, ouroDepois: depois, ouroGasto: Math.max(0, antes - depois), temAgora: ganho };
    logEvent('ornn', { acao: 'montar', ...res });
    return res;
  }

  /** Anuncia no MERCADO os lendários <A da mochila (MENOR tier primeiro), a 90% do menor preço do
   *  mesmo item+tier. Mercado com 10 ofertas: se não forem todas lendárias, cancela uma de ÉPICO
   *  pra abrir vaga. (Regra do dono: lendário A+ e Rabadon NUNCA.) */
  async function anunciarLendarios() {
    ocupado = true;
    try {
    const bag = scanBag(); if (!bag) return { ok: false, motivo: 'sem bolsa' };
    const cand = (bag.items || []).filter((i) => i.kind === 'item' && i.raridade === 'lendario' && QUAL.includes(i.qual) && qIdx(i.qual) < qIdx('A') && !ehPrioridadeExtrema(i.base) && !ehLendarioDaBuild(i.base));
    if (!cand.length) return { ok: true, anunciados: [], motivo: 'sem lendário <A (ou todos são da build da classe)' };
    cand.sort((a, b) => qIdx(a.qual) - qIdx(b.qual) || (a.refino || 0) - (b.refino || 0));   // menor tier primeiro
    // LÊ O MERCADO PRIMEIRO, na aba "Comprar" (o lerMinhasOfertas troca pra "Minhas" e zerava o comparativo)
    const mm = mercadoEl(true); if (mm && mm.hidden) { press('j'); await esperar(500); }
    mm?.querySelector('[data-aba="comprar"]')?.click(); await esperar(500);
    const mercado = lerMercado() || [];
    const minhas = (await lerMinhasOfertas()) || [];
    _ofertasCache = minhas;                                        // saturação passa a saber o que está anunciado
    const anunciados = []; const cancelados = [];
    for (const it of cand) {
      if (ehLendarioDaBuild(it.base)) continue;                            // lendário da build da classe: NUNCA anuncia
      if (minhas.length + anunciados.length >= 10 - cancelados.length) { /* cheio: tenta abrir vaga */ }
      if (minhas.some((o) => String(o.base) === String(it.base))) continue;      // já anunciado
      if (minhas.length + anunciados.length - cancelados.length >= 10) {
        const epi = minhas.find((o) => !String(o.raridade || '').toLowerCase().startsWith('lend') && !cancelados.includes(o.id));
        if (!epi) break;                                                          // só lendárias → saturado (Lojista cuida)
        await cancelarOferta(epi.id); cancelados.push(epi.id); await esperar(350);
      }
      const mk = mercado.filter((x) => String(x.base) === String(it.base) && x.preco > 0);
      const mesmoTier = mk.filter((x) => String(x.qual || '').toUpperCase() === String(it.qual || '').toUpperCase());
      const base = (mesmoTier.length ? mesmoTier : mk).map((x) => x.preco).filter((p) => p > 0);
      const menor = base.length ? Math.min(...base) : null;
      // SEM REFERÊNCIA DE PREÇO NO MERCADO: PEDIDO DO DONO (2026-10-14, verbatim): "1,5." -> o
      // preço passa a ser `cfg.precoSemComparavel` (1.500.000, configurável) em vez de PULAR o
      // anúncio. O mínimo do jogo (`minimoMercado`, lido dentro do `anunciarItemPorBase`)
      // continua a ser respeitado como PISO — é isso que impede vender pelo mínimo.
      const preco = menor ? Math.max(1, Math.round(menor * 0.9)) : Math.max(1, Math.round(numOr(cfg.precoSemComparavel, 1500000)));
      if (!menor) anunciados.push({ base: it.base, qual: it.qual, semComparavel: preco });
      const r = await anunciarItemPorBase(it.base, preco);
      if (r.ok) anunciados.push({ base: it.base, qual: it.qual, preco }); else break;
    }
    if (Array.isArray(_ofertasCache)) for (const a of anunciados) if (a.preco) _ofertasCache.push({ id: 'novo:' + a.base + ':' + a.qual, base: a.base, qual: a.qual, raridade: 'lendario', preco: a.preco });
    logEvent('mercado', { acao: 'anunciar-lendarios', anunciados: anunciados.length, cancelados: cancelados.length });
    return { ok: true, anunciados, cancelados };
    } finally { ocupado = false; }
  }

  /** Ofertas de COMPRA abertas no Mercado: [{ id, base, qual, preco }] (id = data-comprar). */
  function lerOfertasCompra() {
    const m = q1('#janela-mercado'); if (!m) return [];
    return [...m.querySelectorAll('[data-comprar]')].map((b) => {
      const card = b.closest('.mj-oferta, article, li, div') || b.parentElement;
      const txt = (card?.textContent || '').replace(/\s+/g, ' ');
      const img = card?.querySelector('img')?.getAttribute('src') || '';
      const mq = txt.match(/\[([A-Z]{1,2})\]/);
      // VENDEDOR e MOEDA passam a ser lidos do DOM, como o JOGO os desenha (jogo.js:2667-2668):
      // o nome em .mj-vend b e o preco/moeda em .preco. Sem isto a watch por NOME DE JOGADOR
      // nao tinha como ver o vendedor (o banco WATCH cobre isto com oferta do 'srdog').
      const vend = card?.querySelector('.mj-vend b');
      const prEl = card?.querySelector('.preco');
      const precoTxt = (prEl?.textContent || '').replace(/\s+/g, ' ').trim();
      const pr = txt.match(/([\d.,]+\s*[kKmM]?)\s*ouro/i);
      const mnum = precoTxt.match(/([\d.,]+\s*[kKmM]?)/i);
      const preco = mnum ? parseBig(mnum[1]) : pr ? parseBig(pr[1]) : null;
      const moeda = /💠/.test(precoTxt) ? 'orbs' : /💎/.test(precoTxt) ? 'diamante' : 'ouro';
      const vendedor = ((vend && vend.textContent) || '').trim() || null;
      return { id: b.dataset.comprar, base: (img.match(/\/(\d+)\.png/) || [])[1] || null, qual: mq ? mq[1] : null, preco, moeda, vendedor, txt: txt.slice(0, 120) };
    }).filter((o) => o.preco);
  }

  /** BUILD IDEAL do campeão: 1 bota + 4 melhores (por `poderItem`) entre TODOS os itens lendários/épicos. */
  // AUTO-CORRECÇÃO PREGUIÇOSA: NÃO depender de temporizadores. Medido: depois de um
  // restart do browser o META do motor volta a dizer 'katarina' e, se o tick/bomba não
  // estiver a correr, o `champAtual` fica errado e a build volta a ser AP. Aqui a
  // identidade é reconfirmada SEMPRE que alguém pede a build — correcto por construção.
  /** NORMALIZA a fase: o motor e o PESO_FASE falam 'mobs' | 'chefe'; a GUI e o log chamam-lhe
   *  'boss'. Aceitam-se as duas grafias. ANTES: buildIdeal('mobs') e buildIdeal('boss')
   *  devolviam a MESMA lista que buildIdeal() — MEDIDO pelo Lead: o argumento nao chegava ao
   *  montarBuildDe, apesar de cfg.buildPorFase estar ligado. */
  const normalizaFase = (f) => (f === 'boss' || f === 'chefe') ? 'chefe' : (f === 'mobs' ? 'mobs' : null);
  function buildIdeal(fase) { garantirCampeao(); return montarBuildDe(META.champAtual, normalizaFase(fase)); }
  /** BUILD IDEAL para QUALQUER campeão (perfil próprio) — usado no plano de todos.
   *  `fase` ausente/null = build ÚNICA de sempre (é o que o banco de regressão fixa). */
  function buildIdealPara(c) { return montarBuildDe(c, null); }
  /** BUILD DA FASE para QUALQUER campeão: MOB ou CHEFE (ver PESO_FASE, no topo do ficheiro). */
  function buildIdealParaFase(c, fase) { return montarBuildDe(c, fase || null); }
  /** BUILD do campeão ACTUAL na fase pedida ('mobs' | 'chefe'); sem campeão, lista vazia. */
  function buildDaFase(fase) {
    garantirCampeao();
    const c = META.champAtual || null;
    if (!c) return [];
    return montarBuildDe(c, fase || null).map(String);
  }
  /** BUILD de MOB do campeão actual (o que maximiza limpeza de grupos). */
  function buildParaMob() { return buildDaFase('mobs'); }
  /** BUILD de CHEFE do campeão actual (um alvo, armadura alta, luta longa). */
  function buildParaChefe() { return buildDaFase('chefe'); }
  /** O corpo da build ideal, parametrizado pelos pesos (fase) — UMA implementação só, para a
   *  build da classe (fase null) e as builds de mob/chefe não poderem divergir na REGRA.
   *  A regra é a mesma de sempre: 1 bota + 4 melhores entre épicos e lendários do catálogo. */
  function montarBuildDe(c, fase) {
    const perfil = perfilDe(c);
    const classe = c && c.magia ? 'ap' : 'ad';
    const pesos = fase ? pesosItemFase(perfil, fase) : pesosItem(perfil);
    const bonusDe = (id) => (fase ? bonusItemFase(id, fase) : 1);
    // ALVO DE REFERÊNCIA para as passivas que escalam com a VIDA DO ALVO (ver `valorPctVida`).
    // REGRA DO LEAD (2026-10-14): a `3153` NÃO é promovida no FARM DE MOBS — contra mob comum a
    // vida é baixa e o teto morde, e a build de farm tem de ficar como estava (é a que os testes
    // do banco fixam). O termo só entra nas builds que enfrentam VIDA ALTA: a de CHEFE e a IDEAL
    // (que pontua contra o chefe de maior tier — ver `alvoDeReferencia`). Sem alvo, o termo é 0
    // e a pontuação fica exactamente como era.
    // A passiva que escala com o alvo (3153) SO ENTRA NA BUILD DE CHEFE (regra do Lead, 2026-10-14):
    // contra mobs a vida e baixa e o simulador mede-a como a PIOR candidata (488, ultimo de 11);
    // contra o chefe e a melhor (4055-6351). A build IDEAL (fase null) tambem NAO a promove — era
    // estar a vestir a peca de chefe no farm. Com fase 'chefe' o alvo de referencia e o chefe.
    // B1: a build IDEAL (fase null) pontua contra o CHEFE de maior tier — logo TAMBEM promove a 3153
    // (o farm de mobs continua sem ela: a vida e baixa e o teto morde).
    const alvoRef = (fase === 'chefe' || fase == null) ? alvoDeReferencia('chefe') : null;
    // ---- PEÇAS REAIS vs CATÁLOGO (correcção do Lead, 2026-10-14) --------------------------------
    // O dono tem `4629+3~A` (94,5 AP, 23,46% cdr) e o motor comparava o `4629` BASE (70 AP, 15% cdr)
    // -> recomendava o `6653` Liandry. Não era divergência de modelo: era FALTA DE DADOS (a peça
    // concreta). As fontes são as MESMAS do resto do ficheiro (`readEquip` + `scanBag`); o melhor
    // exemplar de cada base manda, com o SEU refino e a SUA qualidade escalados como o motor
    // (motor.js:254-255: ad/ap/mana/vida/armadura/rm/va/rv/critico/regen/cdr; penMag NÃO escala).
    const reais = new Map();   // base -> { id, qual, refino, mult }
    const guarda = (id) => {
      try {
        const p = parseSlotId(id); if (!p.base) return;
        const cur = reais.get(p.base);
        if (!cur || p.mult > cur.mult) reais.set(p.base, { id: String(id), qual: p.qual, refino: p.refino, mult: p.mult });
      } catch { /* ignore */ }
    };
    try { for (const e of readEquip()) guarda(e.id || e.base); } catch { /* sem DOM */ }
    try { for (const b of ((scanBag() || {}).items || [])) { if (b.kind === 'item') guarda(b.id || b.base); } } catch { /* sem DOM */ }
    const pecaDe = (base) => reais.get(String(base)) || null;
    const poder = (i) => {
      const peca = pecaDe(i.id);
      // ESCALA DESLIGADA (2026-10-14): ligar a qualidade/refino da peça REAL aqui mudou as decisões
      // de EQUIPAMENTO no banco (E5: o Rabadon fraco deixava de sair) — o `montarBuildDe` alimenta o
      // `planoEquipar`/`alvoEquip`, e o efeito colateral tem de ser reconciliado antes. O mapa das
      // peças reais (`reais`) fica montado e pronto; falta decidir ONDE a escala entra sem mexer no
      // equipamento. REVERTIDO para `mm = 1` (comportamento anterior) — não deixar vermelho.
      const mm = 1;
      const e = (v) => (v || 0) * mm;
      const v = e(i.ad) * pesos.ad + e(i.ap) * pesos.ap + e(i.va) * pesos.va + e(i.critico) * pesos.critico + e(i.rv) * pesos.rv
        + e(i.vida) * pesos.vida + e(i.armadura) * pesos.armadura + e(i.rm) * pesos.rm
        + e(i.cdr) * pesos.cdr + (i.penMag || 0) * pesos.penMag + e(i.mana) * pesos.mana + e(i.regen) * pesos.regen + valorPassiva(i.id, c)
        + valorPctVida(i.id, alvoRef, c);   // passivas que dependem do alvo (3153: 5% da vida DELE)
      const cl = classeItem(i.id);
      const multClasse = cl === 'neutro' ? 1 : (cl === classe ? 1 : 0.12);
      const ofensivo = (i.ad || 0) + (i.ap || 0) + (i.va || 0) + (i.critico || 0) + (i.rv || 0) + (i.cdr || 0) + (i.penMag || 0);
      const multDef = (perfil !== 'tanque' && ofensivo === 0) ? 0.3 : 1;
      return v * multClasse * multDef * (({ basico: 1, epico: 1.15, lendario: 1.35 })[i.raridade] || 1) * bonusDe(i.id);
    };
    const todos = (META.itens || []).filter((i) => i.raridade === 'lendario' || i.raridade === 'epico');
    const cmp = (a, b) => (poder(b) - poder(a)) || (String(a.id) < String(b.id) ? -1 : 1);
    const botas = todos.filter((i) => i.espaco === 'botas').sort(cmp)[0] || null;
    const usados = new Set(botas ? [String(botas.id)] : []);
    const out = botas ? [String(botas.id)] : [];
    // ALVO FIXO DO DONO (cfg.objetivoItem): entra logo a seguir as botas e NUNCA e
    // filtrado pelo multiplicador de classe - e um pedido explicito, nao uma estimativa.
    // Sem isto o Rabadon num campeao AD levava 0.12x e era inalcancavel por construcao.
    try {
      const alvoBruto = cfg && cfg.objetivoItem;
      const alvo = alvoBruto == null ? null
        : (/^rabadon$/i.test(String(alvoBruto)) ? RABADON : String(alvoBruto));
      if (alvo && !usados.has(alvo)) {
        const it = todos.find((i) => String(i.id) === alvo);
        // O ALVO FIXO RESPEITA A CLASSE (correcção do Lead, 2026-10-14). O objetivo entrava
        // ANTES de qualquer filtro, logo o Rabadon (AP) aparecia em TODAS as builds — MEDIDO:
        // `buildIdealPara({magia:false})` -> "3172,3089,3046,6631,3031" (Rabadon numa build AD).
        // A classe sai da MESMA função do resto do ficheiro (`classeItem`, automation.js:3528);
        // o dono pode forçar um alvo de classe oposta com `cfg.objetivoItemForcar: true`.
        // Mesma classe/neutro continua a entrar como sempre (o Rabadon na Katarina/Lux).
        const cl = classeItem(alvo);
        if (it && (cl === 'neutro' || cl === classe || cfg.objetivoItemForcar === true)) { usados.add(alvo); out.push(alvo); }
      }
    } catch { /* alvo invalido nao pode quebrar a build */ }
    for (const i of todos.slice().sort(cmp)) {
      if (out.length >= 5) break;
      if (usados.has(String(i.id))) continue;
      if (i.espaco === 'botas') continue;
      usados.add(String(i.id)); out.push(String(i.id));
    }
    return out;
  }

  // =====================================================================================
  // AS QUATRO FONTES DE ITENS (pedido do dono, verbatim):
  //   "tem q saber ... tanto na mochila, quando no que ta anunciado do mercado, quanto que ta
  //    no cofre"
  //   (a) EQUIPADO -> readEquip()        — o que está vestido
  //   (b) MOCHILA  -> scanBag()          — o que está na bolsa
  //   (c) MERCADO  -> minhasOfertas()    — o que está ANUNCIADO e continua a ser meu
  //                                        (cancelar a oferta devolve o item à mochila)
  //   (d) COFRE    -> cofreConhecido()   — slots abertos (verdade viva) ou a última leitura
  //                                        guardada por salvarCofre() no storage
  // =====================================================================================
  let _cofreCache = [];
  let _cofreAt = null;                      // M3: instante da ultima gravacao do cofre (para a GUI)
  try { chrome.storage.local.get(STORAGE_KEY + ':cofre', (r) => { _cofreCache = (r && r[STORAGE_KEY + ':cofre'] && r[STORAGE_KEY + ':cofre'].itens) || []; }); } catch { /* ignore */ }
  let _ofertasPedidas = false;
  /** Minhas ofertas no mercado (o que está ANUNCIADO e continua a ser meu). */
  function minhasOfertas() {
    if (!Array.isArray(_ofertasCache) && !_ofertasPedidas) { _ofertasPedidas = true; try { ofertasEmCache(); } catch { /* ignore */ } }
    return Array.isArray(_ofertasCache) ? _ofertasCache : [];
  }
  /** O que está NO COFRE: os slots abertos (verdade viva) ou a última leitura guardada. */
  /** M3 (pedido do subagent da GUI): `{ at, itens }` para a GUI dizer QUANDO foi lido, sem
   *  precisar de ler a chave crua do storage. O `at` e o instante da ultima gravacao. */
  function cofreInfo() { return { at: _cofreAt, itens: cofreConhecido() }; }
  function cofreConhecido() {
    let live = [];
    try { live = lerCofreSlots().filter((i) => i.acao === 'retirar' || i.acao === 'sacar'); } catch { live = []; }
    if (live.length) { _cofreCache = live; return live; }
    return _cofreCache || [];
  }
  /** Mapa base -> MELHOR instância conhecida e DE ONDE VEM (equipado/mochila/mercado/cofre). */
  function fontesDeItens(bag) {
    const out = new Map();
    const add = (base, fonte, qual, refino, extra) => {
      const b = String(base == null ? '' : base).replace(/[+~].*$/, '');
      if (!b) return;
      const novo = { base: b, fonte: fonte, qual: qual || 'C', refino: refino || 0 };
      if (extra) for (const k of Object.keys(extra)) novo[k] = extra[k];
      const cur = out.get(b);
      if (!cur || qIdx(novo.qual) > qIdx(cur.qual) || (qIdx(novo.qual) === qIdx(cur.qual) && novo.refino > cur.refino)) out.set(b, novo);
    };
    try { for (const e of readEquip()) add(e.base, 'equipado', e.qual, e.refino, { id: e.id }); } catch { /* sem DOM */ }
    try { const b = bag || scanBag(); for (const i of ((b && b.items) || [])) if (i.kind === 'item') add(i.base, 'mochila', i.qual, i.refino, { id: i.id }); } catch { /* sem DOM */ }
    try { for (const o of minhasOfertas()) add(o.base, 'mercado', o.qual, 0, { id: o.id, preco: o.preco }); } catch { /* sem DOM */ }
    try { for (const c of cofreConhecido()) add(c.base, 'cofre', c.qual, c.refino, { nome: c.nome }); } catch { /* sem DOM */ }
    return out;
  }
  /** O MELHOR CONJUNTO ALCANÇÁVEL com as quatro fontes + o que IR BUSCAR + o que FALTA. */
  function alvoQuatroFontes(fase) {
    const f = fase === undefined ? faseBuild() : (fase || null);
    const bag = (() => { try { return scanBag(); } catch { return null; } })();
    const fontes = fontesDeItens(bag);
    const ctx = { equipados: readEquip().map((e) => String(e.base)), fase: f };
    const cmp = (a, b) => cmpEquipFase(a, b, ctx, f);
    const alvoTotal = escolherConjunto(porMelhorBase([...fontes.values()]), cmp);
    const buscar = alvoTotal.filter((i) => i.fonte === 'cofre' || i.fonte === 'mercado')
      .map((i) => ({ base: String(i.base), nome: (infoItem(i.base) || {}).nome || String(i.base), fonte: i.fonte, id: i.id != null ? i.id : null, preco: i.preco != null ? i.preco : null }));
    const c = META.champAtual || null;
    const teorica = c ? montarBuildDe(c, f).map(String) : [];
    const faltamTotal = teorica.filter((b) => !fontes.has(String(b)))
      .map((b) => ({ base: b, nome: (infoItem(b) || {}).nome || b }));
    return { fase: f, fontes, alvoTotal, buscar, faltamTotal };
  }
  /** PLANO DE UMA FASE para a GUI e para o log: a build, de ONDE vem cada peça, o que falta
   *  em cada uma e qual está equipada AGORA. */
  function planoBuildFase(fase) {
    const f = fase === 'chefe' ? 'chefe' : 'mobs';
    garantirCampeao();
    const c = META.champAtual || null;
    const ids = c ? montarBuildDe(c, f).map(String) : [];
    const fontes = fontesDeItens();
    const eqBase = new Set(readEquip().map((e) => String(e.base)));
    const itens = ids.map((b) => {
      const info = infoItem(b) || {};
      const fo = fontes.get(b);
      return {
        base: b, nome: info.nome || b, raridade: rarDe(b), preco: info.preco != null ? info.preco : null,
        fonte: fo ? fo.fonte : 'falta', qual: fo ? fo.qual : null, refino: fo ? fo.refino : 0,
        equipado: eqBase.has(b), porque: motivoFase(b, f),
      };
    });
    const alcancavel = alvoQuatroFontes(f);
    const equipadaAgora = ids.length > 0 && eqBase.size === ids.length && ids.every((b) => eqBase.has(b));
    return {
      fase: f, campeao: c ? c.id : null, on: cfg.buildPorFase !== false, ativa: faseAtual() === f,
      itens: itens, faltam: itens.filter((i) => i.fonte === 'falta'),
      buscar: itens.filter((i) => i.fonte === 'cofre' || i.fonte === 'mercado'),
      alvoAlcancavel: (alcancavel.alvoTotal || []).map((i) => ({ base: String(i.base), fonte: i.fonte, nome: (infoItem(i.base) || {}).nome || String(i.base) })),
      equipadaAgora: equipadaAgora,
      pesos: PESO_FASE[f] ? PESO_FASE[f].stat : null,
      motivos: ids.map((b) => motivoFase(b, f)).filter(Boolean),
    };
  }

  // ------------------------------------------------------------- PEÇAS RESERVADAS (as 2 builds)
  let _reservCache = null;
  /** BASES que pertencem a QUALQUER uma das duas builds (mob e chefe) do campeão actual.
   *  São as peças que a troca por fase vai voltar a usar: NUNCA podem ser vendidas nem
   *  anunciadas — era este o furo que vendia a build de mobs quando ele vestia a de chefe.
   *  Sem campeão identificado, ou com a alternância desligada, é VAZIO (nada é blindado a mais). */
  function basesReservadas() {
    if (cfg.buildPorFase === false) return new Set();
    const c = META.champAtual || null;
    if (!c) return new Set();
    const pap = c.papel || {};
    const chave = [c.id != null ? c.id : '', c.magia ? 'ap' : 'ad', c.distancia ? 'r' : 'm', pap.dano, pap.recebido, (META.itens || []).length].join('|');
    if (_reservCache && _reservCache.chave === chave) return _reservCache.set;
    const set = new Set();
    for (const f of ['mobs', 'chefe']) for (const id of montarBuildDe(c, f)) set.add(String(id));
    _reservCache = { chave: chave, set: set };
    return set;
  }
  /** Em que builds (mobs/chefe) este item entra — para o motivo do log e da GUI. */
  function fasesDoItem(base) {
    const c = META.champAtual || null;
    if (!c || cfg.buildPorFase === false) return [];
    const b = String(base == null ? '' : base).replace(/[+~].*$/, '');
    return ['mobs', 'chefe'].filter((f) => montarBuildDe(c, f).some((id) => String(id) === b));
  }
  /** Este item-base é peça reservada de alguma das duas builds? (aceita '3089+2'/'3089~A') */
  const ehReservado = (base) => basesReservadas().has(String(base == null ? '' : base).replace(/[+~].*$/, ''));

  // ------------------------------------------------------------- TROCA DE BUILD POR FASE
  let _ultimaFaseBuild = null, _ultimaBuildAplicada = null, _ultimoLerCofre = 0;
  /** Puxa do COFRE as bases pedidas (o cofre abre na Fonte e nas cidades — motor.js podeCofre). */
  async function puxarDoCofre(bases) {
    const abriu = await abrirCofreTesoureira();
    if (!abriu || !abriu.ok) return { ok: false, motivo: (abriu && abriu.motivo) || 'sem cofre aqui', retirados: [] };
    const retirados = [];
    for (const b of bases) { const r = await retirarDoCofre(b); if (r && r.ok) retirados.push(String(b)); await esperar(200); }
    fecharJanelas();
    scanBag(true);
    return { ok: retirados.length > 0, retirados: retirados };
  }
  /** Puxa do MERCADO as bases pedidas: cancela as MINHAS ofertas (o item volta à mochila). */
  async function puxarDoMercado(bases) {
    const m = mercadoEl(true); if (!m) return { ok: false, motivo: 'sem mercado', cancelados: [] };
    if (m.hidden) { press('j'); await esperar(500); }
    m.querySelector('[data-aba="minhas"]')?.click(); await esperar(450);
    const minhas = (await lerMinhasOfertas()) || [];
    _ofertasCache = minhas;
    const cancelados = [];
    for (const b of bases) {
      const o = minhas.find((x) => String(x.base) === String(b));
      if (!o) continue;
      if (cancelarOferta(o.id)) cancelados.push(String(b));
      await esperar(350);
    }
    fecharMercado();
    scanBag(true);
    return { ok: cancelados.length > 0, cancelados: cancelados };
  }
  /** Bases da build da fase que a extensão SABE que estão no cofre (última leitura guardada).
   *  É a pergunta que acende a necessidade `buscar` na base — sem leitura, é vazio. */
  function pecasDaFaseNoCofre(fase) {
    const f = fase === 'chefe' ? 'chefe' : 'mobs';
    if (cfg.buildPorFase === false) return [];
    const c = META.champAtual || null;
    if (!c) return [];
    const alvo = montarBuildDe(c, f).map(String);
    const cofre = cofreConhecido();
    if (!cofre.length) return [];
    const bases = new Set(cofre.map((x) => String(x.base)));
    return alvo.filter((b) => bases.has(String(b)));
  }
  /** VAI BUSCAR ao cofre o que a build da fase tem lá guardado. */
  async function buscarPecasDaFase(fase) {
    const f = fase === 'chefe' ? 'chefe' : 'mobs';
    if (cfg.buildPorFase === false) return { ok: true, retirados: [], motivo: 'alternância desligada' };
    const alvo = buildDaFase(f);
    if (!alvo.length) return { ok: true, retirados: [], motivo: 'sem campeão identificado' };
    const fontes = fontesDeItens();
    const noCofre = alvo.filter((b) => { const x = fontes.get(String(b)); return x && x.fonte === 'cofre'; });
    if (!noCofre.length) return { ok: true, retirados: [], motivo: 'nada da build de ' + f + ' no cofre' };
    const r = await puxarDoCofre(noCofre);
    logEvent('cofre', { acao: 'buscar-build', fase: f, pedidos: noCofre, retirados: r.retirados, ok: r.ok });
    return { ok: r.ok, retirados: r.retirados, fase: f, motivo: r.motivo || null };
  }
  /** LÊ o cofre (OPORTUNIDADE: só quando já se está na base) para saber o que lá está. */
  async function lerCofreBase() {
    const abriu = await abrirCofreTesoureira();
    if (!abriu || !abriu.ok) return { ok: false, motivo: (abriu && abriu.motivo) || 'sem cofre aqui' };
    const itens = salvarCofre();
    _cofreCache = itens;
    fecharJanelas();
    return { ok: true, itens: itens.length };
  }
  /** TROCA DE BUILD POR FASE — DECIDIDA pela fase, não por margem.
   *   · entra em chefe -> build de CHEFE; volta aos mobs -> build de MOB;
   *   · só troca quando as 5 peças EXISTEM (equipado/mochila/mercado/cofre): sem peça NÃO
   *     desmonta a build que está a funcionar — o que sai fica na MOCHILA e é reservado;
   *   · a histerese é só DENTRO da mesma fase (a mesma build não se re-aplica duas vezes),
   *     entre builds a troca é decidida pela fase — nunca por margem de valor. */
  // HISTERESE DE FASE — DEFEITO MEDIDO (dono, 2026-10-14: "eu to vendo a build sendo trocada toda
  // hora, a build parece aleatoria"). O chefe nasce a 1,5% por wave e morre em segundos;
  // `faseAtual()` vira 'chefe' e volta a 'mobs' logo a seguir. A guarda de 'ja aplicada nesta
  // fase' so trava a MESMA fase repetida — quando a fase ALTERNA, cada transicao troca a build
  // INTEIRA. Resultado: churn a cada chefe. Agora a fase tem de PERSISTIR antes de valer uma
  // troca, e ha um intervalo minimo entre trocas. `cfg.faseEstavelSeg` e
  // `cfg.trocaBuildCooldownMs` sao configuraveis.
  let _faseVista = null, _faseDesde = 0, _ultimaTrocaBuildAt = 0;
  async function trocarBuildDaFase() {
    if (cfg.buildPorFase === false) return { ok: false, feito: false, motivo: 'alternância DESLIGADA (buildPorFase=false)' };
    const fase = faseAtual();
    const _ag = Date.now();
    if (_faseVista !== fase) { _faseVista = fase; _faseDesde = _ag; }
    const minSeg = (cfg.faseEstavelSeg != null ? cfg.faseEstavelSeg : 15) * 1000;
    const cooldown = (cfg.trocaBuildCooldownMs != null ? cfg.trocaBuildCooldownMs : 90000);
    if (_ag - (_faseDesde || _ag) < minSeg) {
      return { ok: true, feito: false, fase: fase, motivo: 'fase "' + fase + '" ainda nao persistiu ' + Math.round(minSeg / 1000) + 's (evita trocar a build a cada chefe)' };
    }
    if (_ultimaTrocaBuildAt && (_ag - _ultimaTrocaBuildAt) < cooldown) {
      return { ok: true, feito: false, fase: fase, motivo: 'cooldown de troca de build (' + Math.round((cooldown - (_ag - _ultimaTrocaBuildAt)) / 1000) + 's restantes)' };
    }
    garantirCampeao();
    const alvoIds = (META.champAtual ? montarBuildDe(META.champAtual, fase).map(String) : []);
    if (!alvoIds.length) return { ok: false, feito: false, fase: fase, motivo: 'sem campeão identificado' };
    const atual = readEquip().map((e) => baseDe(e.id)).sort().join(',');
    const alvoTxt = alvoIds.slice().sort().join(',');
    if (atual === alvoTxt) {
      _ultimaFaseBuild = fase; _ultimaBuildAplicada = { fase: fase, itens: alvoIds.slice(), at: Date.now() };
      return { ok: true, feito: false, fase: fase, motivo: 'já é a build de ' + fase };
    }
    if (_ultimaFaseBuild === fase && _ultimaBuildAplicada && _ultimaBuildAplicada.itens.slice().sort().join(',') === alvoTxt) {
      return { ok: true, feito: false, fase: fase, motivo: 'build de ' + fase + ' já aplicada nesta fase (sem oscilar)' };
    }
    const fontes = fontesDeItens();
    const falta = alvoIds.filter((b) => !fontes.has(String(b)));
    const saem = readEquip().map((e) => String(e.base)).filter((b) => alvoIds.indexOf(b) < 0);
    const entram = alvoIds.filter((b) => !readEquip().some((e) => String(e.base) === b));
    if (falta.length) {
      logEvent('build-fase', { fase: fase, trocou: false, motivo: 'peças indisponíveis (nem equipado, nem mochila, nem mercado, nem cofre)', falta: falta.map((b) => ({ base: b, nome: (infoItem(b) || {}).nome || b })), alvo: alvoIds });
      return { ok: true, feito: false, fase: fase, falta: falta, motivo: 'faltam ' + falta.length + ' peça(s) da build de ' + fase };
    }
    itensBusy = true; itensAt = Date.now();
    try {
      // (1) O QUE ESTÁ NO COFRE/MERCADO VEM PRIMEIRO PARA A MOCHILA
      const doCofre = alvoIds.filter((b) => { const x = fontes.get(String(b)); return x && x.fonte === 'cofre'; });
      const doMercado = alvoIds.filter((b) => { const x = fontes.get(String(b)); return x && x.fonte === 'mercado'; });
      const busca = {};
      if (doCofre.length) busca.cofre = await puxarDoCofre(doCofre);
      if (doMercado.length) busca.mercado = await puxarDoMercado(doMercado);
      // (2) VESTE a build da fase (o que sai fica na mochila — e é reservado)
      const r = await aplicarItens(alvoIds);
      _ultimaFaseBuild = fase; _ultimaBuildAplicada = { fase: fase, itens: alvoIds.slice(), at: Date.now() };
      logEvent('build-fase', {
        fase: fase, trocou: true,
        entram: entram.map((b) => ({ base: b, nome: (infoItem(b) || {}).nome || b })),
        saem: saem.map((b) => ({ base: b, nome: (infoItem(b) || {}).nome || b, ficou: 'mochila (reservada)' })),
        porque: 'a fase mudou para ' + fase, busca: busca,
      });
      return { ok: !!(r && r.ok), feito: true, fase: fase, entram: entram, saem: saem, busca: busca, equipado: r && r.equipado };
    } finally { itensBusy = false; }
  }

  /** SNAPSHOT COMPLETO do jogo em JSON — base p/ SIMULAR caminhos e decidir melhor. */
  function snapshotJogo() {
    const M = META || {};
    const p = player() || {};
    const loc = readLocation() || {};
    const nome = (id) => { const it = (M.itens || []).find((x) => String(x.id) === String(id)); return it ? it.nome : String(id); };
    const detalhe = (base) => { const it = (M.itens || []).find((x) => String(x.id) === String(base)); return it ? { id: it.id, nome: it.nome, raridade: it.raridade, espaco: it.espaco, preco: it.preco, de: it.de || [], ad: it.ad, ap: it.ap, va: it.va, critico: it.critico, rv: it.rv, vida: it.vida, armadura: it.armadura, rm: it.rm, cdr: it.cdr, mana: it.mana, efeito: it.efeito || null } : null; };
    const eq = readEquip();
    let bag = null; try { bag = scanBag(); } catch { /* ignore */ }
    const sk = (() => { try { return readSkills(); } catch { return { bar: [], arsenal: [], pontos: 0 }; } })();
    const st = (() => { try { return readStats(); } catch { return null; } })();
    const ideal = buildIdeal();
    const eqCtx = { equipados: eq.map((e) => String(e.base)) };   // sinergia p/ o valor (decisão)
    const tenho = new Set(eq.map((e) => e.base));
    for (const i of ((bag && bag.items) || [])) if (i.kind === 'item') tenho.add(i.base);
    return {
      at: Date.now(),
      campeao: M.champAtual ? { id: M.champAtual.id, magia: !!M.champAtual.magia, distancia: !!M.champAtual.distancia, papel: M.champAtual.papel || null } : null,
      perfil: perfilCampeao(),
      identidade: identidadeCampeao(),
      buildDaClasse: buildDaClasse().map((id) => ({ id, nome: nome(id), lendarioDaBuild: ehLendarioDaBuild(id) })),
      jogador: { nivel: p.nivel, hp: p.vida, hpMax: p.vidaMax, ouro: readGold() },
      local: { texto: loc.text || null, faixa: loc.range || null },
      equipado: eq.map((e) => ({ id: e.id, base: e.base, nome: nome(e.base), qual: e.qual, refino: e.refino, valor: Math.round(valorDe(e.base, eqCtx)), poder: Math.round(poderItem(e.base, e.qual, e.refino)) })),   // `poder` = número do MOTOR, só exibição
      mochila: ((bag && bag.items) || []).map((i) => i.kind === 'item'
        ? { id: i.id, base: i.base, nome: nome(i.base), raridade: i.raridade, qual: i.qual, refino: i.refino || 0, valor: Math.round(valorDe(i.base, eqCtx)), poder: Math.round(poderItem(i.base, i.qual, i.refino || 0)), receita: (detalhe(i.base) || {}).de || [] }
        : { espolio: i.id, qtd: i.qty }),
      mochilaUso: bag ? { used: bag.used, cap: bag.cap, espolios: bag.espacosEspolio } : null,
      skills: { barra: (sk.bar || []).map((b) => b.t), pontos: sk.pontos || 0, ranks: (sk.arsenal || []).map((h) => h.t + ':' + h.rank + '/' + h.maxRank),
        // RECARGA EXACTA de cada skill da barra (fraccao `--cd`, jogo.js:6228) — o `<em>` do HUD
        // some abaixo de 1 s e era lido como 0 = PRONTA.
        recarga: (sk.bar || []).map((b) => ({ t: b.t, seg: b.cd, frac: b.cdFrac != null ? +b.cdFrac.toFixed(3) : null, pronta: !!b.ready, semMana: !!b.semMana, aprimorada: !!b.aprimorada })) },
      // EFEITOS ACTIVOS (`#hud-buffs`, jogo.js:6164-6177) e RECARGA DE ITEM (`#hud-equip`,
      // jogo.js:6181-6193): o jogo desenha os dois e a extensao nunca os leu.
      buffs: (() => { try { return lerBuffs(); } catch { return []; } })(),
      recargaItens: (() => { try { return lerRecargaItens(); } catch { return []; } })(),
      // O MEDIDOR DO JOGO (jogo.js:523-542): a AUTORIDADE em xp/h, ouro/h, abates/h e DPS.
      analiseJogo: (() => { try { return lerAnaliseJogo(); } catch { return null; } })(),
      atributos: st,
      buildIdeal: ideal.map((id) => ({ id, nome: nome(id), item: detalhe(id) })),
      basicsNecessarios: (() => { const n = basicosDaBuild(M.champAtual); const o = {}; for (const k in n) o[nome(k)] = n[k]; return o; })(),
      planoMochila: (() => { try { const pl = bag ? planBag(bag) : null; return pl ? { vender: (pl.acts || []).filter((a) => a.action === 'VENDER_LOJISTA').map((a) => a.it.id), guardar: (pl.acts || []).filter((a) => a.action === 'GUARDAR').map((a) => a.it.id), cofre: (pl.acts || []).filter((a) => a.action === 'GUARDAR_COFRE').map((a) => a.it.id) } : null; } catch { return null; } })(),
      necessidades: (() => { try { return necessidadesBase(); } catch { return null; } })(),
      farm: { ciclos: (farm.cycles || []).length, mortes: (farm.deaths || []).length },
      pocoes: (() => { try { return readPotions(); } catch { return null; } })(),
      mortes: (farm.deaths || []).slice(0, 10),
      estimativas: {
        regiaoIdeal: (() => { try { return regiaoIdeal(); } catch { return null; } })(),
        valeComprar: (() => { const o = {}; for (const id of ideal) { if (tenho.has(id)) continue; try { o[nome(id)] = valeComprar(id, 1); } catch { /* ignore */ } } return o; })(),
      },
    };
  }

  /** SIMULA o melhor caminho a partir do estado atual: o que fazer, em que ordem, e a PREVISÃO. */
  async function simularCaminho() {
    const S = snapshotJogo();
    const nome = (id) => { const it = (META.itens || []).find((x) => String(x.id) === String(id)); return it ? it.nome : String(id); };
    const byId = new Map((META.itens || []).map((i) => [String(i.id), i]));
    const tenho = {};
    for (const e of S.equipado) tenho[e.base] = (tenho[e.base] || 0) + 1;
    for (const i of S.mochila) if (i.base) tenho[i.base] = (tenho[i.base] || 0) + 1;
    const caminho = [];
    const add = (p, onde, acao, porque, previsao) => caminho.push({ p, onde, acao, porque, previsao: previsao || null });

    // ---- 1) BASE (só o que falta) ----
    const n = S.necessidades || {};
    const u = S.mochilaUso || {};
    if (n.presente) add(1, 'base', 'pegar presentes', 'grátis (prêmio diário / pegar e equipar)');
    if (n.cura) add(2, 'base', 'curar na Soraka', `HP ${S.jogador.hp}/${S.jogador.hpMax}`);
    if (n.vender) add(3, 'base', `vender ${(S.planoMochila?.vender || []).length} no Lojista`, `mochila ${u.used}/${u.cap}`, { mochilaDepois: `${u.used - (S.planoMochila?.vender || []).length}/${u.cap}` });
    if (n.repor) add(4, 'base', 'repor poções', 'abaixo do mínimo p/ o ouro', { ouroDepois: 'máx 40% do ouro' });
    if (n.tarefa) add(5, 'base', 'tarefas (entregar/aceitar)', 'recompensa (xp+ouro+item)');
    if (n.hab) add(6, 'base', `subir habilidades (${S.skills.pontos} pontos)`, 'maior DPS', { skill: 'a de MAIOR dps' });
    if (n.atrib) add(7, 'base', 'distribuir atributos', `modelo do campeão (${S.perfil})`);
    if (n.equip) add(8, 'base', 'equipar melhor conjunto', `poder equipado ${Math.round(S.equipado.reduce((s, e) => s + e.poder, 0))}`);
    if (n.cofre) add(9, 'base', 'guardar épico S/SS no cofre', 'não ocupa mochila');
    if (n.mercado) add(10, 'base', 'mercado: anunciar lendário <A (90% do menor)', 'nunca abaixo do mínimo');
    if (n.refino) add(11, 'base', 'Ornn: refinar lendário A+ até +3', 'equipado');

    // ---- 2) MERCADO: comprar o ideal mais barato que cabe ----
    let mercado = [];
    try {
      const m = q1('#janela-mercado');
      if (m && !m.hidden) {
        m.querySelector('[data-aba="comprar"]')?.click(); await esperar(500);
        for (const b of S.buildIdeal) {
          if (tenho[b.id]) continue;
          const inp = q1('#mercado-busca');
          if (inp) { inp.value = b.nome; inp.dispatchEvent(new Event('input', { bubbles: true })); await esperar(400); }
          const cards = [...m.querySelectorAll('.mj-card[data-grupo]')].filter((c) => String((c.dataset.grupo || '').split('~')[0]) === String(b.id));
          let cands = [];
          for (const c of cards) { c.click(); await esperar(400); cands = cands.concat(lerOfertasCompra()); }
          cands.sort((x, y) => x.preco - y.preco);
          if (cands.length) mercado.push({ id: b.id, nome: b.nome, menor: cands[0].preco, n: cands.length });
        }
      }
    } catch { /* ignore */ }
    mercado.sort((a, b) => a.menor - b.menor);
    const ouro = S.jogador.ouro;
    const teto = Math.floor(ouro * 0.5);
    for (const o of mercado) {
      const v = (() => { try { return valeComprar(o.id, o.menor); } catch { return null; } })();
      const cabe = o.menor <= teto;
      const vale = !v || v.ok;
      if (cabe && vale) { add(12, 'mercado', `COMPRAR ${o.nome} por ${o.menor}`, `mais barato (${o.n} ofertas) e farmar custaria ${v ? v.tempoMin + 'min' : '?'}`, { ouroDepois: ouro - o.menor, ganho: `${nome(o.id)} entra na build ideal` }); break; }
      add(13, 'mercado', `NÃO comprar ${o.nome}`, !cabe ? `caro (${o.menor} > teto ${teto})` : `farmar vale mais (${v && v.tempoMin}min)`);
    }

    // ---- 3) FALTAM BÁSICOS? onde farmar ----
    const falta = Object.entries(S.basicsNecessarios || {}).map(([nm, q]) => { const id = [...byId.values()].find((i) => i.nome === nm)?.id; return { id, nm, falta: Math.max(0, q - (tenho[id] || 0)) }; }).filter((x) => x.falta > 0);
    for (const f of falta) {
      const onde = (META.ondeItem || {})[f.id];
      const reg = onde ? Object.values(onde)[0]?.zona?.nome : null;
      add(14, 'farm', `farmar ${f.falta}× ${f.nm}`, reg ? `dropa em ${reg}` : 'sem dado de drop');
    }

    // ---- 4) FARM ----
    const reg = S.estimativas.regiaoIdeal;
    add(15, 'farm', `farmar em ${reg}`, 'melhor xp/ouro p/ o nível');

    const ordenado = caminho.sort((a, b) => a.p - b.p);
    logEvent('simulacao', { passos: ordenado.length });
    return { agora: { campeao: S.campeao?.id, perfil: S.perfil, nivel: S.jogador.nivel, ouro, local: S.local.texto, equipado: S.equipado.map((e) => e.id), buildIdeal: S.buildIdeal.map((b) => b.nome), mochila: u }, caminho: ordenado, proximo: ordenado[0] || null };
  }

  /** SUBSTITUTOS (MULETAS) de um item: mesma classe/espaço, valor entre 55% e 98% do ideal.
   *  O valor é o MEU (stats + passiva + sinergia), nunca o `poder` do motor. */
  function substitutos(id) {
    const alvo = (META.itens || []).find((x) => String(x.id) === String(id));
    if (!alvo) return [];
    let ctx = { equipados: [] };
    try { ctx = { equipados: readEquip().map((e) => String(e.base)) }; } catch { /* sem DOM */ }
    const pIdeal = valorDe(id, ctx);
    const classe = (META.champAtual && META.champAtual.magia) ? 'ap' : 'ad';
    return (META.itens || []).filter((i) => String(i.id) !== String(id)
      && (i.raridade === 'lendario' || i.raridade === 'epico')
      && (i.espaco === alvo.espaco || classeItem(i.id) === classe)
      && valorDe(i.id, ctx) >= pIdeal * 0.55
      && valorDe(i.id, ctx) <= pIdeal * 0.98)
      .sort((a, b) => valorDe(b.id, ctx) - valorDe(a.id, ctx)).slice(0, 6);
  }

  /** MELHOR COMPRA: comprar o IDEAL agora, uma MULETA (substituto mais barato), ou ESPERAR?
   *  Vale p/ qualquer campeão/conta/run. Usa preço de mercado + disponibilidade + poder + ouro/min. */
  async function melhorCompra() {
    const S = snapshotJogo();
    const ouro = S.jogador.ouro;
    const tenho = new Set(S.equipado.map((e) => e.base));
    for (const i of S.mochila) if (i.base) tenho.add(i.base);
    const faltam = S.buildIdeal.filter((b) => !tenho.has(b.id));
    if (!faltam.length) return { ok: true, ouro, decisao: [], resumo: 'build ideal completa' };
    const m = mercadoEl(true); if (!m) return { ok: false, motivo: 'sem mercado' };
    if (m.hidden) { press('j'); await esperar(600); }
    m.querySelector('[data-aba="comprar"]')?.click(); await esperar(500);
    const precoDe = async (base, nome) => {
      const inp = q1('#mercado-busca');
      if (inp && nome) { inp.value = nome; inp.dispatchEvent(new Event('input', { bubbles: true })); await esperar(420); }
      const cards = [...m.querySelectorAll('.mj-card[data-grupo]')].filter((c) => String((c.dataset.grupo || '').split('~')[0]) === String(base));
      let cands = [];
      for (const c of cards) { c.click(); await esperar(400); cands = cands.concat(lerOfertasCompra()); }
      cands.sort((a, b) => a.preco - b.preco);
      return cands.length ? { menor: cands[0].preco, n: cands.length } : null;
    };
    // gpm: ouro/min usado para estimar 'quanto tempo até poder comprar'.
    // BUG (achado na auditoria da build): cfg.ouroMin = 4000 esta 5-13x acima do
    // MEDIDO (641,8 ouro/min na rota-sup, 811 na rota-inf) -> esperaMin saía 5-13x
    // curto e a decisão de compra assentava num número inventado.
    // Agora usa o ouro/min REAL observado (agregar por região), com o cfg só como
    // último recurso quando ainda não há histórico.
    const gpm = Math.max(1, (() => {
      try {
        const vals = (agregar() || []).map((x) => x.goldMin || 0).filter((v) => v > 0);
        if (vals.length) return Math.max(...vals);
      } catch { /* ignore */ }
      return cfg.ouroMin || 4000;
    })());
    const ctxValor = { equipados: S.equipado.map((e) => String(e.base)) };
    const decisao = [];
    for (const b of faltam) {
      const pIdeal = Math.round(valorDe(b.id, ctxValor));
      const of = await precoDe(b.id, b.nome);
      const cabeIdeal = of && of.menor <= ouro * 0.5;
      const esperaMin = of ? Math.max(0, Math.ceil((of.menor - ouro) / gpm)) : null;
      // candidatos muleta
      const subs = substitutos(b.id);
      let melhorSub = null;
      for (const s of subs.slice(0, 4)) {
        const os = await precoDe(s.id, s.nome);
        if (!os) continue;
        const p = Math.round(valorDe(s.id, ctxValor));
        const ganhoPct = Math.round((p / pIdeal) * 100);
        const cabe = os.menor <= ouro * 0.5;
        if (!melhorSub || (cabe && os.menor < melhorSub.preco)) melhorSub = { id: s.id, nome: s.nome, preco: os.menor, n: os.n, poder: p, ganhoPct, cabe };
      }
      let acao;
      const esperaMuletaMin = melhorSub ? Math.max(0, Math.ceil((melhorSub.preco - ouro) / gpm)) : null;
      // custo-benefício: poder ganho por minuto de farm
      const cbiIdeal = of ? (pIdeal / Math.max(1, esperaMin || 0)) : 0;
      const cbiMuleta = melhorSub ? (melhorSub.poder / Math.max(1, esperaMuletaMin || 0)) : 0;
      if (cabeIdeal) acao = 'COMPRAR O IDEAL agora';
      else if (melhorSub && melhorSub.cabe && melhorSub.ganhoPct >= 60) acao = 'COMPRAR MULETA agora (ideal depois)';
      else if (melhorSub && cbiMuleta > cbiIdeal * 1.3 && melhorSub.ganhoPct >= 60) acao = `FARMAR ${esperaMuletaMin}min → MULETA ${melhorSub.nome} (${melhorSub.ganhoPct}% do ideal); ideal depois`;
      else if (of && esperaMin != null && esperaMin <= 60) acao = `FARMAR ${esperaMin}min → IDEAL (≤1h)`;
      else if (of) acao = `FARMAR ${esperaMin}min → IDEAL`;
      else acao = melhorSub ? `SEM OFERTA do ideal; muleta ${melhorSub.nome} em ${esperaMuletaMin}min` : 'SEM OFERTA — farmar o drop';
      decisao.push({ item: b.nome, id: b.id, poderIdeal: pIdeal, ofertaIdeal: of, cabeIdeal, esperaMin, muleta: melhorSub, esperaMuletaMin, cbiIdeal: Math.round(cbiIdeal), cbiMuleta: Math.round(cbiMuleta), acao });
    }
    decisao.sort((a, b) => (a.acao.startsWith('COMPRAR') ? 0 : 1) - (b.acao.startsWith('COMPRAR') ? 0 : 1));
    logEvent('melhor-compra', { n: decisao.length });
    return { ok: true, ouro, gpm, decisao, resumo: decisao[0] ? decisao[0].acao + ': ' + decisao[0].item : null };
  }

  /** PLANO DE ITENS DE TODOS OS CAMPEÕES (data-driven do motor) — { id: { perfil, classe, build } }. */
  function planoTodos() {
    const out = {};
    for (const id of Object.keys(META.kits || {})) {
      const c = META.kits[id] || {};
      const champ = { id, magia: c.magia, distancia: c.distancia, papel: c.papel };
      out[id] = { perfil: perfilDe(champ), classe: c.magia ? 'ap' : 'ad', build: buildIdealPara(champ).map((b) => { const it = (META.itens || []).find((x) => String(x.id) === b); return { id: b, nome: it ? it.nome : b }; }) };
    }
    return out;
  }

  /** VALE MAIS COMPRAR QUE FARMAR? Drop = 1/taxa kills (motor: ondeItem[base].<reg>.porClasse[ad|ap]);
   *  tempo = kills / killsMin da região; compara o preço com o OURO que se deixa de ganhar nesse tempo. */
  function valeComprar(base, preco) {
    const c = META.champAtual || {};
    const classe = c.magia ? 'ap' : 'ad';
    const onde = (META.ondeItem || {})[base];
    if (!onde) return { ok: true, motivo: 'sem dado de drop' };
    let melhor = null;
    for (const reg of Object.values(onde)) {
      const taxa = (reg.porClasse && reg.porClasse[classe]) || 0;
      if (taxa > 0 && (!melhor || taxa > melhor.taxa)) melhor = { zona: reg.zona, taxa };
    }
    if (!melhor) return { ok: true, motivo: 'nao dropa p/ a classe' };
    const ag = agregar();
    const cyc = ag.find((x) => x.region === (melhor.zona && melhor.zona.nome)) || ag[0] || null;
    const killsMin = (cyc && cyc.killsMin) || 10;
    const gpmMax = Math.max(...ag.map((x) => x.goldMin || 0));   // ouro/min REAL observado (cfg.ouroMin=4000 estava 5-13x acima)
    const kills = 1 / melhor.taxa;
    const tempoMin = kills / killsMin;
    const custoFarm = tempoMin * gpmMax;   // ouro que deixaria de ganhar farmando esse tempo
    return { ok: preco <= custoFarm, taxa: melhor.taxa, kills: Math.round(kills), tempoMin: Math.round(tempoMin), custoFarm: Math.round(custoFarm), regiao: melhor.zona && melhor.zona.nome };
  }

  /** COMPRA no Mercado o que vale a pena para o campeão: itens da BUILD IDEAL que faltam,
   *  pelo MENOR preço, respeitando o orçamento (nunca zera o ouro). Só no Mercador (base).
   *  Com a alternância LIGADA (`cfg.buildPorFase`, por defeito), a lista de compras é a da
   *  build da FASE de agora — comprar a peça do chefe enquanto se farmam mobs era o que fazia
   *  a build andar para trás. Desligada, é a `buildIdeal()` de sempre. */
  async function comprarNoMercado() {
    if (!naBase()) return { ok: false, motivo: 'so no Mercador (base)' };
    ocupado = true;
    try {
      const mm = mercadoEl(true); if (mm && mm.hidden) { press('j'); await esperar(600); }
      mm?.querySelector('[data-aba="comprar"]')?.click(); await esperar(650);
      const ofertas = lerOfertasCompra();
      if (!ofertas.length) { /* os grupos carregam sob demanda — segue mesmo assim */ }
      const ideal = cfg.buildPorFase !== false ? buildDaFase(faseAtual()) : buildIdeal();
      const tenho = new Set(readEquip().map((e) => e.base));
      try { for (const i of (scanBag().items || [])) if (i.kind === 'item') tenho.add(i.base); } catch { /* ignore */ }
      let ouro = readGold();
      const compras = [];
      for (const base of ideal) {
        if (tenho.has(base)) continue;                                    // já tem
        // filtra a lista (190 grupos) pela BUSCA e clica no GRUPO do item (.mj-card[data-grupo]="base~qual")
        const nome = (infoItem(base) || {}).nome || '';
        const inp = q1('#mercado-busca');
        if (inp && nome) { inp.value = nome; inp.dispatchEvent(new Event('input', { bubbles: true })); await esperar(550); }
        const cards = [...mm.querySelectorAll('.mj-card[data-grupo]')].filter((c) => String((c.dataset.grupo || '').split('~')[0]) === String(base));
        let cands = [];
        for (const c of cards) { c.click(); await esperar(600); cands = cands.concat(lerOfertasCompra().map((o) => ({ ...o, base, qual: (String(c.dataset.grupo || '').split('~')[1]) || o.qual }))); }
        cands.sort((a, b) => a.preco - b.preco);
        if (!cands.length) continue;
        const melhor = cands[0];
        // RESERVA DE POÇÃO data-driven. Antes: `ouro * 0.5` — uma reserva de METADE do
        // ouro para poções que custam ~5.200 por lote completo. Efeito medido: com
        // 151.300 de ouro o tecto era 75.650, e como um lendário custa 180.000-350.000
        // o mercado NUNCA comprava nada. A intenção do dono era "nunca zerar o ouro",
        // não "guardar metade". Passa a reservar o custo de 3 reposições completas,
        // com piso de 20.000 — folgado para poções e sem bloquear a build.
        // CUIDADO com a base do cálculo: `cfg.buyPotion` (3000/1500/700) são QUANTIDADES
        // compradas, não um lote pequeno; multiplicá-las pelo preço unitário (40/110/260)
        // dá ~467.000 por "lote" e uma reserva de 1,4M — que zerava o tecto e piorava o
        // problema que eu queria resolver (apanhei isto ao MEDIR, não ao confiar na conta).
        // A base certa é o STOCK MÍNIMO que a extensão quer manter (`cfg.minPotion`),
        // que é o que "nunca zerar o ouro" realmente significa:
        //   200x40 + 100x110 + 30x260 = 26.800 -> reserva de 2x = 53.600.
        const minP = cfg.minPotion || { vida: 200, vidaF: 100, vidaS: 30 };
        const custoMin = (minP.vida || 0) * PRECO_POCAO.vida + (minP.vidaF || 0) * PRECO_POCAO.vidaF + (minP.vidaS || 0) * PRECO_POCAO.vidaS;
        const reservaPoc = Math.max(20000, custoMin * 2);
        const teto = Math.max(0, Math.floor(ouro - reservaPoc));
        if (melhor.preco > teto) { compras.push({ base, preco: melhor.preco, comprou: false, motivo: 'caro demais' }); continue; }
        const v = valeComprar(base, melhor.preco);
        if (!v.ok) { compras.push({ base, preco: melhor.preco, comprou: false, motivo: 'farmar vale mais (' + (v.motivo || '') + ' ' + (v.tempoMin || '?') + 'min)' }); continue; }
        const b = q1(`#janela-mercado [data-comprar="${melhor.id}"]`);
        if (!b) continue;
        b.click(); await esperar(550);
        clicarDialogo(/^\s*comprar\s*$|^\s*sim\s*$/i); await esperar(650);
        ouro = readGold();
        compras.push({ base, nome: (infoItem(base) || {}).nome, preco: melhor.preco, comprou: true, ouroDepois: ouro });
        break;                                                            // 1 compra por passada (evita travar)
      }
      logEvent('mercado', { acao: 'comprar', compras });
      return { ok: true, compras };
    } finally { ocupado = false; }
  }

  // =====================================================================================
  // WATCH-LIST DO MERCADO — DETECCAO EM TEMPO REAL E AUTO-COMPRA
  // (PEDIDO DO DONO, 2026-10-18, verbatim): "faz um subagent fazer auto compra no mercado,
  // detectando em TEMPO REAL o mercado sobre os itens q eu quero dar watch. e por nome de player."
  //
  // FONTE (lida em docs/game-src/jogo.js, Regra No 1):
  //   - a oferta do mercado tem id/item/preco/moeda/vendedor: o ecra desenha o.vendedor em
  //     .mj-vend b (jogo.js:2667), o.preco/o.moeda em .preco (jogo.js:2631,2668) e o botao
  //     [data-comprar="<o.id>"] (jogo.js:2669).
  //   - o.item e "<base>[+refino][~qualidade]", "gema:<id>:<qtd>" (jogo.js:198) ou
  //     "mascote:<id>" (motor.js:130).
  //   - o mercado COMPLETO (ofertas + vendedor) vem do servidor por /api/mercado
  //     (rede.mercado -> jogo.js:2513; a variante leve com ?leve=1 em jogo.js:3001).
  //   - COMPRAR e clique em [data-comprar] -> operarServidor('comprar',{id})
  //     (jogo.js:2954-2960; jogo.js:2825) — passa pelo servidor e sincroniza o estado.
  //
  // SEMANTICA DA WATCH: UNIAO. Casa se o ITEM esta na lista OU o VENDEDOR esta na lista
  // (o dono pediu as duas coisas em separado: itens que quer, e por nome de player).
  // NUNCA casa oferta minha (o.minha) nem reservada a outro (o.para sem o.paraMim).
  // A AUTO-COMPRA so gasta OURO (nunca Gemas/diamantes — dinheiro a serio); com TetO de
  // preco (cfg.mercadoWatch.precoMax) e com a RESERVA de ouro das pocoes que o resto da
  // extensao ja usa (nunca zera o ouro).
  // =====================================================================================
  /** Base de um o.item (aceita item, lote de runas e mascote). */
  function baseDoItemMercado(item) {
    const s = String(item == null ? '' : item);
    if (/^gema:/.test(s)) return s;            // lote de runas: casa pelo item inteiro
    if (/^mascote:/.test(s)) return s;         // mascote: casa pelo item inteiro
    try { const p = parseSlotId(s); if (p && p.base) return String(p.base); } catch { /* ignore */ }
    return baseDe(s);
  }
  /** Este o.item casa com a watch-list de ITENS? (id completo, id-base ou nome). */
  function itemNaWatch(item, itens) {
    const s = String(item == null ? '' : item);
    const base = baseDoItemMercado(s);
    let nome = '';
    try { nome = String((infoItem(base) || {}).nome || '').toLowerCase(); } catch { nome = ''; }
    for (const raw of (itens || [])) {
      const w = String(raw == null ? '' : raw).trim(); if (!w) continue;
      const wl = w.toLowerCase();
      if (s === w) return true;                                       // id completo exato
      if (s.split('~')[0] === w) return true;                         // com refino, sem qualidade
      if (base === w) return true;                                    // id-base
      if (nome && nome === wl) return true;                           // nome exato
      if (nome && wl.length >= 3 && nome.indexOf(wl) >= 0) return true;   // nome parcial
    }
    return false;
  }
  /** CASA as ofertas do servidor com a watch-list. PURA (testavel sem browser/rede). */
  function casarOfertas(ofertas, watch) {
    const w = watch || {};
    const itens = (w.itens || []).filter((x) => String(x == null ? '' : x).trim());
    const vendedores = (w.vendedores || []).map((x) => String(x == null ? '' : x).trim().toLowerCase()).filter(Boolean);
    if (!itens.length && !vendedores.length) return [];
    const out = [];
    for (const o of (ofertas || [])) {
      if (!o || typeof o !== 'object') continue;
      if (o.minha) continue;
      if (o.para && o.paraMim !== true) continue;
      const quem = String(o.vendedor == null ? '' : o.vendedor).trim().toLowerCase();
      const casaItem = itens.length ? itemNaWatch(o.item, itens) : false;
      const casaVendedor = vendedores.length ? vendedores.indexOf(quem) >= 0 : false;
      if (casaItem || casaVendedor) out.push(Object.assign({}, o, { casaItem: casaItem, casaVendedor: casaVendedor }));
    }
    return out;
  }
  /** LE o mercado do SERVIDOR (so leitura) — a MESMA rota do jogo (jogo.js:2513, 3001). */
  async function lerMercadoServidor() {
    if (typeof fetch !== 'function') return { ok: false, motivo: 'sem fetch' };
    let token = '';
    try { token = localStorage.getItem('lol-idle-token') || ''; } catch { /* ignore */ }
    try {
      const r = await fetch('/api/mercado', { headers: token ? { Authorization: 'Bearer ' + token } : {} });
      if (!r || !r.ok) return { ok: false, motivo: 'http ' + (r && r.status) };
      const d = await r.json();
      if (!d || !Array.isArray(d.ofertas)) return { ok: false, motivo: 'resposta sem ofertas' };
      return { ok: true, ofertas: d.ofertas, taxa: d.taxa, limite: d.limite };
    } catch (e) { return { ok: false, motivo: String((e && e.message) || e) }; }
  }
  /** Reserva de ouro: o MESMO calculo de comprarNoMercado (nunca zera o ouro — pocoes). */
  function reservaOuroWatch() {
    try {
      const minP = cfg.minPotion || { vida: 200, vidaF: 100, vidaS: 30 };
      const custoMin = (minP.vida || 0) * PRECO_POCAO.vida + (minP.vidaF || 0) * PRECO_POCAO.vidaF + (minP.vidaS || 0) * PRECO_POCAO.vidaS;
      return Math.max(20000, custoMin * 2);
    } catch { return 20000; }
  }
  /** Decide se uma oferta da watch pode ser comprada AGORA (tecto + reserva + saldo). PURA. */
  function podeComprarOfertaWatch(oferta, ouro, watch) {
    const w = watch || {};
    const of = oferta || {};
    const preco = Number(of.preco);
    const moeda = of.moeda || 'ouro';
    if (!(preco >= 1)) return { ok: false, motivo: 'sem preco' };
    if (moeda !== 'ouro') return { ok: false, motivo: 'moeda ' + moeda + ' (a auto-compra so gasta ouro)' };
    const teto = w.precoMax != null && Number(w.precoMax) > 0 ? Number(w.precoMax) : null;
    if (teto != null && preco > teto) return { ok: false, motivo: 'acima do tecto (' + preco + ' > ' + teto + ')' };
    const tetoPass = Number(w.tetoCompra) > 0 ? Number(w.tetoCompra) : Infinity;
    if (preco > tetoPass) return { ok: false, motivo: 'acima do tecto por passagem (' + preco + ' > ' + tetoPass + ')' };
    const disp = Math.max(0, Math.floor((Number(ouro) || 0) - reservaOuroWatch()));
    if (preco > disp) return { ok: false, motivo: 'reserva/saldo (' + preco + ' > ' + disp + ')' };
    return { ok: true };
  }
  /** Encontra a FICHA (.mj-card[data-grupo]) de uma oferta: pelo o.item exato, pela base. */
  function acharCardWatch(m, oferta) {
    if (!m) return null;
    const item = String((oferta && oferta.item) || '');
    const base = baseDoItemMercado(item);
    const cards = [...m.querySelectorAll('.mj-card[data-grupo]')];
    let c = cards.find((x) => String((x.dataset && x.dataset.grupo) || '') === item);
    if (c) return c;
    return cards.find((x) => String((x.dataset && x.dataset.grupo) || '').split('~')[0] === base) || null;
  }
  /** Compra UMA oferta da watch pelo MERCADO do jogo (clique): estado sincronizado. */
  async function comprarOfertaWatch(oferta) {
    if (!oferta) return { ok: false, motivo: 'sem oferta' };
    if (cfg.autoVigiarMercado === false) return { ok: false, motivo: 'vigiar desligado' };
    if (!podeFazer('vigiarMercado').pode) return { ok: false, motivo: 'bloqueado pela hierarquia' };
    if (!naBase()) return { ok: false, motivo: 'so no Mercador (base)' };
    if (ocupado) return { ok: false, motivo: 'ocupado' };
    const pode = podeComprarOfertaWatch(oferta, readGold(), cfg.mercadoWatch);
    if (!pode.ok) return { ok: false, motivo: pode.motivo };
    ocupado = true;
    try {
      const mm = mercadoEl(true); if (!mm) return { ok: false, motivo: 'sem mercado' };
      if (mm.hidden) { press('j'); await esperar(600); }
      mm.querySelector('[data-aba="comprar"]')?.click(); await esperar(550);
      const sel = '#janela-mercado [data-comprar="' + oferta.id + '"]';
      let b = q1(sel);
      if (!b) { const card = acharCardWatch(mm, oferta); if (card) { card.click(); await esperar(550); b = q1(sel); } }
      if (!b) return { ok: false, motivo: 'oferta nao esta no ecra (item nao encontrado)' };
      if (b.disabled) return { ok: false, motivo: 'botao desativado (saldo/reserva do jogo)' };
      b.click(); await esperar(550);
      clicarDialogo(/^\s*comprar\s*$|^\s*sim\s*$/i); await esperar(700);
      logEvent('mercado', { acao: 'watch-comprar', id: oferta.id, vendedor: oferta.vendedor, item: oferta.item, preco: oferta.preco, moeda: oferta.moeda });
      return { ok: true, id: oferta.id, vendedor: oferta.vendedor, preco: oferta.preco, ouroDepois: readGold() };
    } finally { ocupado = false; }
  }
  /** VARREDURA pelo DOM (fallback sem rede): le as ofertas ABERTAS no mercado, com vendedor. */
  function ofertasWatchDoDom() {
    const m = q1('#janela-mercado'); if (!m) return [];
    return [...m.querySelectorAll('[data-comprar]')].map((b) => {
      const card = b.closest('.mj-oferta, article, li, div') || b.parentElement;
      const txt = ((card && card.textContent) || '').replace(/\s+/g, ' ').trim();
      const img = (card && card.querySelector('img') && card.querySelector('img').getAttribute('src')) || '';
      const vend = card && card.querySelector('.mj-vend b');
      const pr = card && card.querySelector('.preco');
      const precoTxt = ((pr && pr.textContent) || '').replace(/\s+/g, ' ').trim();
      const mnum = precoTxt.match(/([\d.,]+\s*[kKmM]?)/i);
      return {
        id: b.dataset.comprar,
        item: b.dataset.item || (img.match(/\/(\d+)\.png/) || [])[1] || null,
        base: (img.match(/\/(\d+)\.png/) || [])[1] || null,
        vendedor: ((vend && vend.textContent) || '').trim() || null,
        preco: mnum ? parseBig(mnum[1]) : null,
        moeda: /💠/.test(precoTxt) ? 'orbs' : /💎/.test(precoTxt) ? 'diamante' : 'ouro',
        txt: txt.slice(0, 140),
      };
    }).filter((o) => o.vendedor || o.base);
  }
  /** PASSO do poller: le o mercado, casa com a watch e (na base) compra a mais barata que caiba. */
  let _watchAt = 0, _watchTentou = 0, _watchAchados = [], _watchUltimaCompra = null;
  async function vigiarMercadoPasso() {
    _watchTentou = Date.now();
    if (cfg.autoVigiarMercado === false) return { ok: false, motivo: 'desligado' };
    const w = cfg.mercadoWatch || {};
    if (!((w.itens || []).length || (w.vendedores || []).length)) return { ok: false, motivo: 'sem watch' };
    const r = await lerMercadoServidor();
    if (!r.ok) return r;
    const achados = casarOfertas(r.ofertas, w);
    _watchAchados = achados;
    _watchAt = Date.now();
    if (!achados.length) return { ok: true, achados: [], comprou: null, n: r.ofertas.length };
    logEvent('mercado', { acao: 'watch', n: achados.length, primeiro: { id: achados[0].id, vendedor: achados[0].vendedor, item: achados[0].item, preco: achados[0].preco, moeda: achados[0].moeda } });
    if (!naBase()) return { ok: true, achados: achados, comprou: null, motivo: 'achou, mas so no Mercador (base)' };
    let comprou = null;
    const cands = achados.slice().sort((a, b) => Number(a.preco) - Number(b.preco)).slice(0, 5);
    for (const o of cands) { comprou = await comprarOfertaWatch(o); if (comprou.ok) break; }
    _watchUltimaCompra = comprou;
    return { ok: true, achados: achados, comprou: comprou };
  }
  /** ESTADO para a GUI: a watch actual e o ultimo achado (sem rede de novo). */
  function mercadoWatchEstado() {
    const w = cfg.mercadoWatch || {};
    return {
      ligado: cfg.autoVigiarMercado !== false,
      itens: (w.itens || []).slice(), vendedores: (w.vendedores || []).slice(),
      precoMax: w.precoMax == null ? null : w.precoMax,
      tetoCompra: w.tetoCompra == null ? null : w.tetoCompra,
      cadenciaMs: w.cadenciaMs == null ? null : w.cadenciaMs,
      at: _watchAt, achados: _watchAchados.slice(0, 20), ultimaCompra: _watchUltimaCompra,
    };
  }
  // --------------------------------------------- troca de itens por CONTEXTO
  let ultimoCtxItens = null, itensBusy = false, itensAt = 0;
  const itemDisponivel = (base) => readEquip().some((e) => e.base === String(base)) || (() => { try { const b = scanBag(); return (b?.items || []).some((i) => i.kind === 'item' && i.base === String(base)); } catch { return false; } })();
  /** Score de um CONJUNTO (soma relativa): AP×(1+%AP) × mit(pen) / (1−CDR). */
  // ============ CRITICO — a conta que faltava (docs/auditoria-do-jogo.md item 7) ============
  //  motor.js:499  `danoCritico = 1,75` (base)
  //  motor.js:515  `if (tem('3031')) danoCritico += 0.4`  -> 2,15
  //  motor.js:541  `critico: min(1, (critico + critBase) * critMult)` e `danoCritico * critDano`
  //                (Yasuo: chance DOBRADA, multiplicador x0,8 -> 1,40 / 1,72)
  //  motor.js:1700 `const critico = ceu || Math.random() < a.critico` — rolado no AUTO-ATAQUE
  //  motor.js:1213 `if (critico) dano *= a.danoCritico || 1.75`
  //  MEDIDO (docs/auditoria-do-jogo.md C7): a build AD/critico faz 2,5x–2,8x o dano da build AP
  //  contra o Barao (sim-chefes: Katarina 3183 vs 1271; Yasuo 6155 vs 1403) e a extensao nao
  //  tinha o critico em conta nenhuma — o 3031 e o 3046 valiam o que os pesos diziam.
  const CRIT_BASE = 1.75;            // motor.js:499
  const CRIT_3031 = 0.4;             // motor.js:515 (Gume do Infinito)
  /** Multiplicador MEDIO de critico: `1 + chance × (danoCrit − 1)`. */
  const multCrit = (chance, danoCrit) => 1 + Math.max(0, Math.min(1, chance || 0)) * (Math.max(1, danoCrit || CRIT_BASE) - 1);
  /** O 3031 (motor.js:515 `danoCritico += 0.4`) ja esta incluido no multiplicador do JOGADOR?
   *  O painel da o multiplicador TOTAL (`#st-critx`, jogo.js:6464): 1,75 sem o 3031, 2,15 com
   *  ele (e 1,40/1,72 no Yasuo, motor.js:541). Convencao: so se soma o +0,4 de um CONJUNTO
   *  quando o do jogador ainda esta na base — senao contava duas vezes. */
  const critJaTem3031 = (multPainel) => (multPainel || CRIT_BASE) > CRIT_BASE + 1e-9;
  /** Fracção do dano que vem das HABILIDADES (o resto são auto-ataques). O critico e rolado no
   *  auto-ataque (motor.js:1700), logo o multiplicador so se aplica a essa parcela — a MESMA
   *  fronteira com que o CDR e separado. */
  function fracHabs() {
    try {
      const lista = (dpsPorHabilidade().habs || []);
      const dh = lista.filter((h) => !h.auto && !h.passiva).reduce((s, h) => s + (h.dps || 0), 0);
      const da = lista.filter((h) => h.auto || h.passiva).reduce((s, h) => s + (h.dps || 0), 0);
      if (dh + da > 0) return dh / (dh + da);
    } catch { /* sem arsenal */ }
    return 0;   // sem dados de habilidades o critico NAO pontua (controlo: sem skills, sem ganho)
  }
  /** Fraccao do dano que vem de AUTO-ATAQUES — a fronteira do critico (motor.js:1700: o
   *  `Math.random() < a.critico` e rolado no ATAQUE, nao nas habilidades puras). Duas partes:
   *  (a) as habilidades de AUTO do arsenal (o ataque reforcado) e (b) o auto-ataque puro,
   *  estimado como `dano x velocidade de ataque` (a MESMA conta que o `player()` documenta). */
  function fracAuto() {
    try {
      const d = dpsPorHabilidade() || {};
      const p = player() || {};
      const habs = d.habs || [];
      const dh = habs.filter((h) => !h.auto && !h.passiva).reduce((s, h) => s + (h.dps || 0), 0);
      const daH = habs.filter((h) => h.auto || h.passiva).reduce((s, h) => s + (h.dps || 0), 0);
      const auto = (p.dano || 0) * (p.va || 0);
      const da = daH + auto;
      if (dh + da > 0) return da / (dh + da);
    } catch { /* sem arsenal */ }
    return 0;
  }
  /** Chance e multiplicador de critico de um CONJUNTO: o do jogador (painel) + o que os itens
   *  do conjunto somam. O +0,4 do 3031 so entra se o jogador ainda nao o tem equipado. */
  function critDoSet(p, S) {
    const chance = (p.critico || 0) + (S.crit || 0);
    const mult = (p.critDano || CRIT_BASE) + ((S.infinito && !critJaTem3031(p.critDano)) ? CRIT_3031 : 0);
    return { chance: Math.min(1, chance), mult };
  }

  /** Score de dano de um conjunto — AGORA com as passivas (Lich/Chama/Liandry), igual ao estimarSet. */
  function scoreSet(ids, alvo) {
    const S = statsSet(ids);
    // Idem `estimarSet`: MITIGAÇÃO PELO TIPO DE DANO do campeão (motor.js:1202).
    // TK-02-150: o ramo FÍSICO usava a pen MÁGICA (`S.pen`), que o motor só dá a quem bate com
    // magia (motor.js:529). Cada pen fica no seu ramo: penArmadura no físico (motor.js:539).
    const magiaCh = !!(META.champAtual && META.champAtual.magia);
    const mit = 100 / (100 + (magiaCh ? armMagicaEfetiva(alvo?.armadura, S.pen) : (alvo?.armadura || 0) * (1 - (S.penArmadura || 0))));
    // BUG CORRIGIDO: usava SEMPRE S.ap, por isso o melhorSet recomendava Rabadon
    // (AP) para o Yasuo (AD) — build errada para o boneco. Agora o tipo de dano
    // vem do campeao: AP usa o AP dos itens; AD usa o dano do campeao (ja com
    // itens) + o AD dos itens. O Lich so entra para magos.
    const magia = !!(META.champAtual && META.champAtual.magia);
    const base = magia ? S.ap : (((player() || {}).dano) || 0) + (S.ad || 0);
    // ---- CDR SÓ NAS HABILIDADES (correcção do Lead, 2026-10-14) --------------------------------
    // O CDR acelera a TAXA DE LANÇAMENTO das habilidades; NÃO aumenta o dano de cada AUTO-ATAQUE.
    // Estrutura correcta: `danoTotal = danoAutos + danoHabilidades/(1-cdr)`. É o que o motor faz:
    //   motor.js:1398/motor.js:3236 `cd = cdBase * (1 - cdr)` -> a RECARGA é que encolhe;
    //   motor.js:1211 `dano = mitigar(bruto, arm) * ...` -> o dano do golpe não depende do CDR.
    // A REPARTIÇÃO vem do `dpsPorHabilidade` (o modelo que já existe e divide cada habilidade pela
    // recarga efectiva) — não há duas contabilidades de CDR a divergir.
    // ANTES: `d = base * mit / (1 - S.cdr)` -> 15% de CDR valia +17,6% em TODO o dano, autos incluídos.
    let fracHabs = 0;   // sem dados de habilidades o CDR NÃO pontua (controlo: sem skills, sem ganho)
    try {
      const lista = (dpsPorHabilidade().habs || []);
      const dh = lista.filter((h) => !h.auto && !h.passiva).reduce((s, h) => s + (h.dps || 0), 0);
      const da = lista.filter((h) => h.auto || h.passiva).reduce((s, h) => s + (h.dps || 0), 0);
      if (dh + da > 0) fracHabs = dh / (dh + da);
    } catch { /* sem arsenal */ }
    const fatorCdr = fracHabs / (1 - S.cdr) + (1 - fracHabs);   // só a parcela das habilidades acelera
      // H12a (motor.js:1199/1226): o CRÍTICO do painel entra SÓ na parcela dos AUTOS — a skill pura não critica.
      const _stC = readStats();
      const _cChance = Number.isFinite(_stC.critChance) ? _stC.critChance : 0;
      const _cMult = Number.isFinite(_stC.critMult) ? _stC.critMult : 1.75;
      const _fracAuto = (typeof fracAuto === 'function') ? fracAuto() : (1 - fracHabs);   // H12a: a MESMA fracção que o teste le
      const fCrit = 1 + _fracAuto * (_cChance * (_cMult - 1));
      let d = (base * mit) * fatorCdr * fCrit * (1 + (magia ? S.lich * 0.15 : 0)); // Lich: +75%AP/skill ≈ +15% no dano total
    if (S.chama) d *= 1 + (alvo?.chefe ? 0.066 : 0.033);        // finisher <40% HP
    if (S.liandry && alvo?.hp) {                                 // queima da Liandry
      const cv = (META.curva && META.curva.hp) || [150, 100, 1];
      const cap = 3 * (cv[0] + cv[1] * (alvo.nivel || 1) + cv[2] * (alvo.nivel || 1) ** 2);
      d += Math.min(alvo.hp, cap) * 0.015;
    }
    // ---- ROUBO DE VIDA: cura/s = dano de AUTO-ATAQUE/s × rv (TK-02-127) ---------------------
    // motor.js:1226-1228 `if (a.rouboVida && fonte === 'ataque') { cura = dano * a.rouboVida ... }`
    // -> SÓ o auto-ataque cura; as habilidades não. O dano de auto-ataque/s é uma grandeza
    // PRÓPRIA (dano por golpe × velocidade de ataque), NÃO uma fracção do dano de habilidade:
    // o `dpsPorHabilidade` só lista habilidades, e multiplicar por `1 - fracHabs` fazia o termo
    // valer ZERO sempre que a barra não tem um auto (era código morto com ar de tratar do assunto).
    // O piso `dano × vel. ataque = DPS de auto-ataque` já é a noção usada no `player()`.
    // EFEITO MEDIDO: a mesma % de rv vale por BASE — numa build AD o auto bate muito mais forte
    // que numa build AP, logo a cura/s difere ordens de grandeza (o dono: 17 cura/s em AP vs 269 em AD).
    // PESO DECLARADO (c): 1 cura/s conta como 1 de dano/s neste score de decisão — é o que faz a
    // build mudar para o roubo de vida quando as poções ficam caras (critério do dono).
    if (S.rv > 0) {
      const pj = player() || {};
      const dpsAuto = (pj.dano || 0) * (pj.va || 0);   // dano por auto × auto-ataques/s
      d += dpsAuto * S.rv;
    }
    return d;
  }
  /** Melhor conjunto (até 5 ids) para o CONTEXTO ('mob' | 'furioso' | 'chefe'). Rabadon sempre dentro. */
  function melhorSet(contexto = 'mob') {
    const loc = readLocation();
    const id = localId(loc.text);
    const L = (META.locais || []).find((x) => x.id === id);
    let monstro = null, nivel = null;
    if (contexto === 'chefe' && L?.chefe) { monstro = L.chefe[0]; nivel = nivelChefeDe(L); }
    else if (L?.monstros?.length) { monstro = L.monstros[0]; nivel = L.nm ? L.nm[1] : (L.faixa ? L.faixa[1] : 0); }
    let alvo = null;
    try { if (monstro && nivel) { const s = statsMonstro(monstro, nivel); if (s) alvo = { armadura: s.armadura, hp: s.hp, nivel, chefe: contexto === 'chefe' }; } } catch { /* ignore */ }
    // BUG CORRIGIDO: o Rabadon era FORÇADO como primeiro item de TODOS os conjuntos
    // (comentário antigo: "Rabadon sempre dentro"). Num campeão AD isso injecta um
    // item AP na build — o Yasuo (AD) recebia Rabadon na recomendação. Agora o
    // Rabadon só é forçado em campeões de magia; para AD o conjunto parte vazio e
    // é o score (que agora usa o dano do campeão) que escolhe.
    const magiaChamp = !!(META.champAtual && META.champAtual.magia);
    const pool = (META.itens || []).filter((it) => (magiaChamp && String(it.id) === RABADON) || itemDisponivel(String(it.id)));
    const set = magiaChamp ? [RABADON] : [];
    let melhor = scoreSet(set, alvo);
    while (set.length < 5) {
      let add = null, val = melhor;
      for (const it of pool) {
        if (set.includes(String(it.id))) continue;
        const v = scoreSet([...set, String(it.id)], alvo);
        if (v > val) { val = v; add = String(it.id); }
      }
      if (!add) break;
      set.push(add); melhor = val;
    }
    const teorico = { itens: set, score: Math.round(melhor) };
    let escolhido = teorico, fonte = 'teorico';
    try {
      if (contexto === 'mob') {   // FARM: o empírico manda (a teoria inverte o ranking de farm — ex.: Chama)
        const rank = rankBuildsTestadas(id).filter((r) => r.mob && r.mob.goldMin != null && (r.confianca?.mob || 0) >= 2);
        rank.sort((a, b) => (b.mob.goldMin || 0) - (a.mob.goldMin || 0));
        if (rank[0]) { escolhido = { itens: rank[0].itens.map(String), score: Math.round(rank[0].mob.goldMin) }; fonte = 'empirico'; }
      } else if (contexto === 'chefe') {   // CHEFE: melhor DPS real contra o chefe
        const rank = rankBuildsTestadas(id).filter((r) => r.chefe && (r.chefe.outDps || r.chefe.dps) != null && (r.confianca?.chefe || 0) >= 1);
        rank.sort((a, b) => (b.chefe.outDps || b.chefe.dps || 0) - (a.chefe.outDps || a.chefe.dps || 0));
        if (rank[0]) { escolhido = { itens: rank[0].itens.map(String), score: Math.round(rank[0].chefe.outDps || rank[0].chefe.dps || 0) }; fonte = 'empirico'; }
      }
    } catch { /* ignore */ }
    return { contexto, regiao: loc.text, alvoArmadura: alvo?.armadura || 0, itens: escolhido.itens, score: escolhido.score, fonte, teorico: teorico.itens };
  }
  /** Aplica a troca de itens conforme a fase (mob × chefe).
   *
   *  DOIS CAMINHOS, e só um corre de cada vez:
   *   (1) `cfg.buildPorFase` (LIGADO POR DEFECTO, pedido do dono): a build é a do MOTOR para a
   *       fase — decidida, sem margem de valor. Ver `trocarBuildDaFase`.
   *   (2) `cfg.trocaItens` (desligado por defeito): o caminho ANTIGO, empírico — o conjunto
   *       que MEDIU melhor naquele contexto (`melhorSet`). Mantido para quem o ligue. */
  async function checarItens() {
    if (!podeFazer('manutencao').pode || itensBusy || pausado) return;   // manutencao, nao auto-play
    if (cfg.buildPorFase !== false) {
      if (Date.now() - itensAt < 20000) return;                     // throttle (o mesmo dos dois)
      try { await trocarBuildDaFase(); } catch (e) { logIssue('tick:build-fase', { erro: String(e) }); }
      return;                                                       // o equipador normal trata do resto
    }
    if (!cfg.trocaItens) return;
    if (Date.now() - itensAt < 20000) return;                       // throttle
    const c = farm.current;
    const ctx = (c && c.fase === 'boss') ? 'chefe' : (c && c.furiosoApareceu && c.furioso ? 'furioso' : 'mob');
    const set = melhorSet(ctx);
    const atual = readEquip().map((e) => baseDe(e.id)).sort().join(',');
    const alvo = set.itens.slice().sort().join(',');
    if (atual === alvo) { ultimoCtxItens = ctx; return; }
    itensBusy = true; itensAt = Date.now();
    try { await aplicarItens(set.itens); logEvent('itens', { contexto: ctx, itens: set.itens, antes: atual }); ultimoCtxItens = ctx; }
    catch { /* ignore */ } finally { itensBusy = false; }
  }

  // ------------------------------------------------------------- giro de regiões
  let giro = null;
  const GIRO_KEY = STORAGE_KEY + ':giro';
  function giroAtivo() { return !!giro; }
  function salvarGiro() { try { chrome.storage.local.set({ [GIRO_KEY]: giro }); } catch { /* ignore */ } }
  function pararGiro() { giro = null; salvarGiro(); return { ok: true }; }
  let _giroVoltas = 0;   // tecto do retry "volta à Fonte" (bug: reagendava-se SEM LIMITE a cada 9 s)
  function proximoGiro() {
    if (!giro || giro.i >= giro.lista.length) { logEvent('giro-fim', { feito: giro ? giro.i : 0 }); giro = null; salvarGiro(); return; }
    if ((readLocation().text || '') !== 'Fonte') {
      if (_giroVoltas >= 5) {
        logEvent('giro', { desistiu: 'nao chegou a Fonte', tentativas: _giroVoltas });
        _giroVoltas = 0; giro = null; salvarGiro(); return;
      }
      // W7: a espera era MUDA (o dono via o boneco parado sem saber porquê) — registar.
      logEvent('giro', { esperaFonte: true, tentativas: _giroVoltas + 1, onde: (readLocation().text || '?') });
      _giroVoltas++;
      press('b');
      return setTimeout(proximoGiro, 9000);
    }
    _giroVoltas = 0;
    const id = giro.lista[giro.i];
    logEvent('giro-ir', { regiao: id, i: giro.i, total: giro.lista.length });
    viajarPara(id);
    const dur = giro.duracaoMs;
    giro.i++; salvarGiro();
    setTimeout(proximoGiro, dur);
  }
  /** Gira por cada região, logando um ciclo em cada. Progresso persistido (retoma de onde parou). */
  function iniciarGiro(ids, duracaoMs) {
    if (giro) return { ok: false, motivo: 'ja ativo' };
    const lista = ids || (META.locais || []).filter((l) => l.faixa && !l.arena).map((l) => l.id);
    if (!lista.length) return { ok: false, motivo: 'sem regioes' };
    giro = { lista, i: 0, duracaoMs: duracaoMs || 5 * 60000, startedAt: Date.now() };
    salvarGiro();
    proximoGiro();
    return { ok: true, lista };
  }

  // ------------------------------------------------------------- troca de skills
  /** Skills prontas fora da barra (desbloqueadas), da maior DPS pra menor.
   *  A ULTIMATE fica FORA desta lista: ela é FIXA na barra (regra do dono) e era por aqui que
   *  ela era deitada fora (o laço de `trocarSkills` clica na barra para tirar a skill em
   *  cooldown — e a ultimate, com recarga longa, está quase sempre em cooldown). */
  function skillsDisponiveis() {
    const s = readSkills();
    const d = dpsPorHabilidade();
    const dpsDe = {}; for (const h of d.habs) dpsDe[h.t] = h.dps || 0;
    return (s.arsenal || []).filter((h) => !h.onBar && h.rank > 0 && !ehUltimateFixa(h.t) && !(KAT[h.t] && (KAT[h.t].util || KAT[h.t].passiva)))
      .map((h) => ({ ...h, dps: dpsDe[h.t] || 0 })).sort((a, b) => b.dps - a.dps);
  }

  /** Troca as skills do slot que estão em cooldown por outras prontas (maximiza uptime). */
  function trocarSkills(dry) {
    const s = readSkills();
    const off = skillsDisponiveis();
    const trocas = [];
    for (const b of (s.bar || [])) {
      if (!(b.cd > 0.5)) continue;                       // só slot em cooldown
      // A ULTIMATE NUNCA SAI DA BARRA (regra do dono; era a queixa mais repetida dele).
      // BUG MEDIDO: eu pus o R na barra e verifiquei pelo DOM (`["Q","E","R","W"]`,
      // `onBar:true`); segundos depois caiu sozinho. Era ISTO: este laço clica na barra
      // (`#barra .hab[data-t=...]`) para TIRAR a skill em cooldown, e a ultimate — que tem
      // recarga longa — está quase sempre em cooldown, logo era a PRIMEIRA a ser deitada fora.
      if (ehUltimate(b.t)) continue;
      const nova = off.shift(); if (!nova) break;
      trocas.push({ sai: b.t, entra: nova.t, novaDps: nova.dps });
      if (!dry) {
        q1(`#hab-ativas .hab[data-t="${nova.t}"]`)?.click();
        setTimeout(() => q1(`#barra .hab[data-t="${b.t}"]`)?.click(), 160);
      }
    }
    return { trocas, offBar: off.length };
  }

  // ---------------------------------------------------- rotação de skills por fase
  const ULT_CD = 35;   // recarga base >= 35s = ultimate (ex.: Lótus da Morte 75s). 24s ainda é normal.
  function ehUltimate(t) { const k = KAT[t]; return !!(k && k.rec && k.rec(1) >= ULT_CD); }
  function faseAtual() { return farm.current?.fase === 'boss' ? 'chefe' : 'mobs'; }
  /** Área difícil: DPS-limitada (burst < HP do mob) ou acima do meu nível. (cache 5s) */
  let _dificil = null, _dificilAt = 0;
  function areaDificil() {
    if (_dificil != null && Date.now() - _dificilAt < 5000) return _dificil;
    _dificilAt = Date.now();
    let d = false;
    try {
      const r = analisarRun();
      if (r.limite === 'dps') d = true;
      else if (r.limite == null) {
        // sem dado de burst: usa TEMPO DE KILL real (mobs lentos = área difícil) antes do nível
        const k = r.killGapMedMs;
        if (k != null && k > (cfg.killLentoMs || 3500)) d = true;
        else { const loc = (META.locais || []).find((l) => l.id === localId(readLocation().text)); if (loc && loc.faixa && player().nivel < loc.faixa[0]) d = true; }
      }
    } catch { /* ignore */ }
    _dificil = d; return d;
  }

  // ------------------------------------------------------------- barra de combate
  /** LÊ A BARRA DO DOM na ordem dos 4 espaços. Estrutura REAL (jogo.js:6124-6129): cada espaço
   *  é `<div class="hab" data-t="X">` ou `<div class="vaga">`, e o `#barra` tem SEMPRE
   *  `M.BARRA` (4) filhos. Uso SÓ o seletor `#barra .hab[data-t]` (o vocabulário do banco de
   *  testes) e conto as VAGAS por diferença: `BARRA_SLOTS − nº de .hab`. */
  function lerBarra() {
    const habs = qa1('#barra .hab[data-t]');
    return { tipos: habs.map((h) => h.dataset.t), n: habs.length, vagas: Math.max(0, BARRA_SLOTS - habs.length) };
  }
  /** Mesmo CONJUNTO (não a mesma ORDEM): a ordem dos espaços é cosmética e comparar por ordem
   *  faria a rotina mexer na barra sem necessidade (churn a cada 2 s). */
  const mesmaBarra = (a, b) => a.length === b.length && a.slice().sort().join(',') === b.slice().sort().join(',');
  /** A ULTIMATE DA BARRA: a tecla R (motor.js:902 `nivelMinimoR`) ou qualquer habilidade cuja
   *  recarga base chegue a `ULT_CD` (motor.js:706 o R do Yasuo = 70 s). */
  const ehUltimateFixa = (t) => t === 'R' || ehUltimate(t);
  /** AS 4 MELHORES para a barra — regras do dono 5 e 6: "Gastar TODOS os pontos: skill points
   *  (com a ULTIMATE na barra)" e "A barra tem de estar cheia com as melhores, INCLUINDO a
   *  ultimate". A ordem é DETERMINÍSTICA e NÃO olha para a recarga: era o `pronto`-primeiro que
   *  fazia a barra mudar a cada 2 s (as recargas mudam sempre) e deitar o R fora.
   *  Prioridade: 1) a ULTIMATE (fixa enquanto tiver rank); 2) as restantes por DPS do rank
   *  ACTUAL (`dpsPorHabilidade`); 3) empate: maior rank, depois a ordem do motor
   *  (motor.js:899 `ORDEM_HAB`). Só entram rank > 0 (motor.js:2837 recusa rank 0) e não
   *  passivas (motor.js:2842 recusa passivas). */
  const ORDEM_HAB_FB = ['Q', 'W', 'E', 'R', 'G', 'A', 'D', 'F', 'T', 'B', 'M', 'N'];
  function barraIdeal(s, fase) {
    s = s || readSkills();
    const dpsDe = {};
    try { for (const h of dpsPorHabilidade().habs) dpsDe[h.t] = h.dps || 0; } catch { /* ignore */ }
    const peso = (t) => { const i = ORDEM_HAB_FB.indexOf(t); return i < 0 ? 99 : i; };
    // SKILLS POR FASE (pedido do dono): no combate de MAPA os mobs vem em GRUPO, logo conta o
    // numero de ALVOS da skill (o `alvos` do kit do motor, ex.: Katarina R tem alvos: 3). No
    // chefe conta o dano de alvo unico. Desligavel por cfg.skillsPorFase === false.
    // O peso da fase propriamente dito (e a prova de que a fase muda o CONJUNTO) está no
    //`pesoFase` abaixo — TK-02-18.
    const porFase = cfg.skillsPorFase !== false && String(fase || '').toLowerCase() === 'mobs';
    const alvosDe = (t) => { const k = KAT[t] || {}; return k.alvos != null ? k.alvos : 1; };
    // ---- PESO DA FASE (TK-02-18): a fase muda o PESO da skill, não só a ordem dela ----
    // Antes a fase só mexia na ORDEM (um `if (porFase)` DEPOIS do bloco de disponibilidade,
    // que nunca era alcançado com `barraPorDisponibilidade` ligado — o default) e o CONJUNTO
    // de 4 era sempre o mesmo: MEDIDO, ideal mobs == ideal chefe para a Katarina. A fase
    // tem de decidir QUAIS skills merecem os 4 lugares:
    //   MOBS  -> vêm em GRUPO: peso = dano × nº de ALVOS (o `alvos` do kit do motor);
    //   CHEFE -> alvo único: peso = dano só.
    // NADA é inventado: `alvos` é campo do kit (motor.js:751/759 Katarina Q/R = 3,
    // motor.js:736 Yasuo M = 4) e o dano é o `dpsPorHabilidade` (fórmulas do motor).
    // ---- OPÇÃO DO DONO: BARRA POR DISPONIBILIDADE (default FALSE) -------------------------
    // ---- BARRA POR DISPONIBILIDADE (DEFAULT TRUE — pedido do dono, ver `DEFAULT`) -----------
    // O dono: "usava tudo disponivel ... e ai removia dos slots pra colocar nos slots as que
    // tavam mais proximas de serem usadas, e assim em loop, o tempo inteiro". O comentário
    // ANTIGO desta função chamava a isto O DEFEITO ("a versão antiga ordenava por `pronto` e por
    // isso a barra mudava a cada 2 s") — o dono diz que era o comportamento PERFEITO, logo a
    // ordem passa a ser dele. Com `cfg.barraPorDisponibilidade === false` volta a ordenação
    // estável de hoje (DPS/rank/ordem do motor), que é o que os testes do banco fixam.
    const porDisp = cfg.barraPorDisponibilidade !== false;
    // RECARGA RESTANTE por skill, lida do HUD (`readSkills().bar[].cd`, em segundos; 0 = pronta).
    // Uma skill FORA da barra não tem recarga legível no HUD → 0 (disponível): é o que o dono
    // descreve ("usava tudo disponivel").
    const cdDe = (t) => { const b = (s.bar || []).find((x) => x.t === t); return b && b.cd > 0 ? b.cd : 0; };
    const idxAtual = (t) => { const i = (s.bar || []).map((b) => b.t).indexOf(t); return i < 0 ? 99 : i; };
    const cand = (s.arsenal || []).filter((h) => h.rank > 0 && !(KAT[h.t] && KAT[h.t].passiva));
    // Peso com que a skill CONCORRE A UM LUGAR na fase atual (multi-alvo em mobs, alvo único
    // no chefe). É o que faz a barra de mobs diferir da de chefe quando o kit tem skills de
    // área — e o que deixa a da Katarina IGUAL quando o kit dela já quer as mesmas 4 nas duas
    // fases (a decisão é do motor, não nossa: Q e R são `alvos: 3` motor.js:751/759 e ficam
    // dentro nas duas).
    const pesoFase = (t) => { const d = dpsDe[t] || 0; const a = alvosDe(t); return porFase && a > 1 ? d * a : d; };
    cand.sort((a, b) => {
      const ua = ehUltimateFixa(a.t) ? 0 : 1, ub = ehUltimateFixa(b.t) ? 0 : 1;
      if (ua !== ub) return ua - ub;                       // a ultimate PRIMEIRO: fica SEMPRE dentro (inviolável)
      // 1) QUEM MERECE O LUGAR: o peso da fase (em mobs, dano × alvos; no chefe, dano).
      //    Desempata por rank e pela ordem do motor (determinístico).
      const pa = pesoFase(a.t), pb = pesoFase(b.t);
      if (pa !== pb) return pb - pa;
      if (porDisp) {
        // 2) A ORDEM DENTRO DA BARRA é a do dono ("usava tudo disponivel"): prontas primeiro,
        //    depois pela recarga RESTANTE (menor primeiro).
        const da = cdDe(a.t), db = cdDe(b.t);
        if (da !== db) return da - db;
        // 3) ANTI-OSCILAÇÃO (obrigatória): MESMA recarga restante -> NÃO reordena. Mantém quem já
        //    está na barra e pela posição que ocupa (é isto que evita o churn de 2 s medido).
        const ia = idxAtual(a.t), ib = idxAtual(b.t);
        if (ia !== ib) return ia - ib;
      }
      return (b.rank - a.rank) || (peso(a.t) - peso(b.t));
    });
    return cand.slice(0, BARRA_SLOTS).map((h) => h.t);
  }
  /** Coloca EXACTAMENTE `tipos` na barra — CONVERGE e PARA.
   *
   *  MECÂNICA REAL DO JOGO (lida, não adivinhada):
   *   - `#habilidades` (delegado, jogo.js:5848) -> `alternarBarra` (motor.js:2834) = TOGGLE.
   *     Se a barra do ESTADO já tiver 4, devolve false e o jogo entra em modo TROCA
   *     (`trocando = hk`, jogo.js:5857) — marcado com `.escolhida` (jogo.js:6604) e a classe
   *     `trocando` no `#barra` (jogo.js:6603).
   *   - O clique SEGUINTE num `#barra .hab` chama `trocarNaBarra` (motor.js:2841) e troca
   *     ATÓMICO no índice clicado (jogo.js:5862-5868).
   *
   *  ARMADILHA MEDIDA pelo Lead: o `estado.barra` do jogo pode estar CHEIO (4) enquanto o DOM
   *  mostra 3 `.hab` + 1 `.vaga` — nesse caso `alternarBarra` RECUSA adicionar. Por isso a
   *  ordem é TIRAR PRIMEIRO (liberta espaço no ESTADO), DEPOIS PÔR. Cada clique chama
   *  `atualizarUI()` (jogo.js:5860/5867), logo o DOM volta a sincronizar a cada passo e a
   *  2.ª passagem já vê a verdade — é por isso que 3 passagens bastam e não há oscilação. */
  async function aplicarBarra(tipos) {
    const alvo = (tipos || []).slice(0, BARRA_SLOTS);
    const tab = q1('[data-aba="habilidades"]');
    if (tab && !tab.classList.contains('ativa')) { tab.click(); await humano(320); }
    const passos = [];
    let tent = 0;
    for (; tent < 3; tent++) {
      // CANCELA um modo TROCA pendente (no TOPO da passagem, antes de tirar nada): o jogo
      // guarda a habilidade escolhida (`trocando`, jogo.js:5857) e clicar nela OUTRA VEZ limpa
      // o modo (`trocando = trocando === hk ? null : hk`). Sem isto, o primeiro clique de
      // "tirar" faria `trocarNaBarra` em vez de `alternarBarra` (motor.js:2841).
      const pend = (readSkills().arsenal || []).filter((x) => x.escolhida);
      for (const h of pend) { q1(`#hab-ativas .hab[data-t="${h.t}"]`)?.click(); passos.push({ acao: 'cancelar-troca', t: h.t }); await humano(150); }
      const antes = lerBarra();
      if (mesmaBarra(antes.tipos, alvo)) return { ok: true, barra: antes.tipos, vagas: antes.vagas, passos, tentativas: tent + 1 };
      // (1) TIRAR tudo o que está na barra e NÃO é alvo (liberta o ESTADO).
      for (const b of antes.tipos) {
        if (alvo.includes(b)) continue;
        q1(`#barra .hab[data-t="${b}"]`)?.click();
        passos.push({ acao: 'tirar', t: b });
        await humano(170);
      }
      // (2) PÔR o que falta, pela ordem de prioridade do alvo (nunca deixa espaço vazio se
      //     houver skill desbloqueada fora da barra — o alvo já vem ordenado e cheio).
      for (const t of alvo) {
        const agora = lerBarra();
        if (agora.tipos.includes(t)) continue;
        if (agora.vagas <= 0) break;                       // sem espaço no DOM: a próxima passagem resolve
        const el = q1(`#hab-ativas .hab[data-t="${t}"]`);
        if (!el) { passos.push({ acao: 'sem-carta', t }); continue; }
        el.click();
        passos.push({ acao: 'por', t });
        await humano(170);
      }
    }
    const fim = lerBarra();
    const ok = mesmaBarra(fim.tipos, alvo);
    if (!ok) logIssue('barra:nao-converge', { alvo, barra: fim.tipos, vagas: fim.vagas, passos });
    return { ok, barra: fim.tipos, vagas: fim.vagas, passos, tentativas: tent };
  }
  /** ROTAÇÃO DA BARRA — estável e sempre com a ULTIMATE.
   *  `desejadas` vem da `barraIdeal` (determinística): enquanto o alvo não mudar, `mudou` é
   *  false e NÃO se clica em nada. Era este o defeito: a versão antiga ordenava por `pronto`
   *  (recarga) e por isso a barra mudava a cada 2 s; e excluía a ultimate fora de chefe
   *  (`usarUlt`), o que a deitava fora — o dono viu a barra errada várias vezes. */
  async function rotacaoSkills(dry) {
    const fase = faseAtual();
    const dificil = areaDificil();
    const s = readSkills();
    const desejadas = barraIdeal(s, fase);          // barra POR FASE (cfg.skillsPorFase)
    const antes = (s.bar || []).map((b) => b.t);
    const mudou = !mesmaBarra(antes, desejadas);
    let aplicado = null;
    if (!dry && mudou) aplicado = await aplicarBarra(desejadas);
    const temUlt = desejadas.some((t) => ehUltimateFixa(t));
    const vagas = lerBarra().vagas;
    return { fase, dificil, usarUlt: true, temUlt, vagas, ritmo: ritmoMobs(), antes, desejadas, mudou, aplicado };
  }

  let _filtroBasicosAt = 0;   // throttle do filtro de básicos (TK-02-27)
  /** Actor do filtro de básicos (TK-02-27): clica em `#ignorar-basicos` quando o critério B
   *  (folhas de receita ainda necessárias) dá 0. Manutenção, não auto-play: é a mochila. */
  async function checarFiltroBasicos() {
    if (!podeFazer('manutencao').pode || pausado) return;
    if (Date.now() - _filtroBasicosAt < 30000) return;      // 30 s: o critério muda devagar
    _filtroBasicosAt = Date.now();
    try { await clicarIgnorarBasicos(); } catch { /* ignore */ }
  }
  let _rotBusy = false;
  let _ultimaRotacao = 0;      // cadência própria da barra (ver `cfg.barraCadenciaMs`)
  async function checarRotacao() {
    // O ACTOR PERGUNTA À HIERARQUIA (correcção do Lead, 2026-10-14): antes havia aqui um portão
    // DIRECTO ao `cfg.enabled`, que ignorava a tabela `INTERRUPTORES` — com o autoplay desligado
    // (Katarina) a barra ficava parada MESMO depois de o `rotacao` passar a depender da manutenção.
    // `podeFazer('rotacao')` sobe a cadeia (rotacao -> manutencao) e aplica o `cfg.rotacaoSkills`.
    if (!podeFazer('rotacao').pode || _rotBusy || pausado) return;
    if (!document.querySelector('#barra .hab[data-t]')) return;   // painel ainda não pronto → tenta depois
    // REAVALIAÇÃO O TEMPO INTEIRO (pedido do dono): com a barra por disponibilidade, a barra é
    // reavaliada a cada `cfg.barraCadenciaMs` (2 s por omissão) — não só quando o CONJUNTO-alvo
    // muda. Isto decide QUAIS skills ficam equipadas; NÃO clica em skills (o farm usa-as sozinho,
    // é coisa do jogo). Com `cfg.barraPorDisponibilidade === false` nada disto corre.
    if (cfg.barraPorDisponibilidade !== false) {
      if (Date.now() - _ultimaRotacao < numOr(cfg.barraCadenciaMs, 2000)) return;
      _ultimaRotacao = Date.now();
    }
    _rotBusy = true;
    try {
      const r = await rotacaoSkills(true);                        // calcula sem aplicar
      if (r.mudou) { const ap = await aplicarBarra(r.desejadas); logEvent('rotacao', { ...r, aplicado: ap }); }
    } catch { /* ignore */ } finally { _rotBusy = false; }
  }

  /** Estima a LUTA contra o chefe de uma região: tempo p/ matar, tempo p/ morrer e nº de poções. */
  function estimarLuta(id) {
    const loc = (META.locais || []).find((l) => l.id === id);
    if (!loc || !loc.chefe) return null;
    const boss = loc.chefe[0];
    const nivel = nivelChefeDe(loc);
    const p = player();
    const s = statsMonstro(boss, nivel);
    if (!s) return null;
    const reg = agregar().find((r) => (loc.nome && r.region.startsWith(loc.nome)));
    const live = (typeof window !== 'undefined' && window.__lolidleLive) || null;
    const healChefe = reg?.healSkillChefeS || 0, healMob = reg?.healSkillS || 0, healLive = live?.rates?.healRate || 0;
    // cura das skills no chefe: MEDIDA na fase de chefe > ao vivo > metade da de mobs (conservador: chefe sozinho = menos AoE)
    let curaSkill = healChefe > 1 ? healChefe : (healLive > 1 ? healLive : healMob * 0.5);
    // CURA DO GIRO (motor.js:2169-2170): teorica, quando nao ha medida. A medida do canvas ja a
    // inclui — por isso e um Math.max e nao uma soma (senao contava duas vezes).
    try {
      const cg = (dpsPorHabilidade() || {}).curaGiro;
      if (cg && cg.tem && cg.porSegundo > curaSkill) curaSkill = cg.porSegundo;
    } catch { /* ignore */ }
    // `p.rv` (roubo de vida) e `p.vidaEff` (vida + escudo) agora existem em `player()` e o
    // `avaliar` usa-os: cura = dano x rv (motor.js:1226-1228).
    const av = avaliar(boss, nivel, p, { skill: curaSkill, pocao: 0 });
    const efEq = efeitosEquipados();
    const meDps = meuDps() || 0;
    // `armEf` JÁ levava a penetração mágica dos itens (tooltip c/ refino) mas FALTAVA o RM_MONSTRO: o dano medido do campeão contra o chefe é MÁGICO (a penetração usada é a mágica) -> motor.js:1202.
    const mitBoss = 100 / (100 + armMagicaEfetiva(s.armadura, efEq.penMag));
    const meuDpsBoss = meDps * mitBoss;
    // motor.js:1200-1202 — monstro BEM ACIMA do nível do jogador aguenta mais (d = nivelAlvo - nivelJogador - livre;
    // fJ = max(minDanoJogador, 1 - danoJogador*d), com piso 0,25). Sem isto o tempo de matar saía optimista.
    const _nd = META.nivelDif || {};
    const _livre = _nd.livre != null ? _nd.livre : 4;
    const _dNiv = Math.max(0, (Number(nivel) || 0) - (Number(p.nivel) || 1) - _livre);
    const fJ = _dNiv ? Math.max(_nd.minDanoJogador != null ? _nd.minDanoJogador : 0.25, 1 - (_nd.danoJogador != null ? _nd.danoJogador : 0.12) * _dNiv) : 1;
    const meuDpsBossFJ = meuDpsBoss * fJ;
    const tKill = meuDpsBossFJ > 0 ? s.hp / meuDpsBossFJ : Infinity;
    // ROUBO DE VIDA (motor.js:1226-1228) + CURA DO GIRO (motor.js:2169) ja entraram no
    // `curaTotal` do `avaliar`; aqui a conta liquida usa essa cura total.
    const net = av.dpsTomado - av.curaTotal;                                 // perda líquida/s sem poção
    const curaPocaoS = Math.max(1, curaPocaoMax()) / EXAUSTAO();            // melhor poção disponível ÷ cooldown do motor
    const netEfetivo = Math.max(0, net - curaPocaoS);
    // VIDA EFECTIVA = vida maxima + ESCUDO activo (motor.js:2718): o `(+N)` do HUD.
    const tMorrer = netEfetivo > 0 ? (p.vidaEff || p.vida) / netEfetivo : Infinity;
    // EMPÍRICO: se já observei lutas contra este chefe, prefiro tempo/poções REAIS à teoria
    const realMs = reg?.bossMs || null;
    const potReal = (reg && reg.potChefe != null) ? Math.round(reg.potChefe) : null;
    const ganha = tKill <= tMorrer;
    const potS = net > 0 ? net / curaPocaoS : 0;                            // poções/s necessárias p/ cobrir o líquido
    return { fJ,
      regiao: loc.nome.replace(/ nível.*/, ''), boss, nivel, hpBoss: Math.round(s.hp), armadura: Math.round(s.armadura),
      dpsChefe: Math.round(av.dpsTomado), curaSkill: Math.round(curaSkill), danoGolpe: Math.round(av.danoGolpe), intervalo: +av.intervalo.toFixed(1),
      meuDpsBoss: Math.round(meuDpsBossFJ), tKillS: realMs ? +(realMs / 1000).toFixed(1) : +tKill.toFixed(1), tMorrerS: tMorrer === Infinity ? null : +tMorrer.toFixed(1),
      ganha, potS: +potS.toFixed(2),
      tKillRealS: realMs ? +(realMs / 1000).toFixed(1) : null, potReal,
      potTotal: potReal != null ? potReal : (ganha ? Math.ceil(potS * tKill) : null),
      ouroPocao: ganha ? Math.round((potReal != null ? potReal : potS * tKill) * 110) : null,
      fonte: realMs ? 'empirico' : 'teorico',
      mortal: !!av.mortal, morre: !!av.morre, piorMec: av.piorMec || null,
    };
  }
  const sobrevivenciaSet = (base, alvo, tipo) => {
    const pl = player();
    const vidaItens = (base || []).reduce((acc, id) => { try { const it = (META.itens || []).find((x) => String(x.id) === String(id)); return acc + ((it && it.vida) || 0); } catch { return acc; } }, 0);
    const vida = ((pl && pl.vida) || 0) + vidaItens;
    let luta = null; try { luta = estimarLuta(tipo) || estimarLuta(alvo); } catch { luta = null; }
    const dIn = (luta && luta.dpsChefe) ? luta.dpsChefe : 0;
    const tMorrer = dIn > 0 ? +(vida / dIn).toFixed(1) : Infinity;
    const tKill = (luta && luta.tKillS) ? luta.tKillS : Infinity;
    const potS = (luta && luta.potS) || 0;
    const nPocoes = (potS > 0 && isFinite(tMorrer)) ? Math.ceil(potS * tMorrer) : 0;
    return { vida, tMorrer, morre: tMorrer < tKill, dps: (() => { try { const e = estimarSet(base, alvo); return (e && e.dps) || (luta && luta.meuDpsBoss) || 0; } catch { return (luta && luta.meuDpsBoss) || 0; } })(), tKill: (() => { try { const e = estimarSet(base, alvo); const d = (e && e.dps) || 0; const hp = (luta && luta.hpBoss) || 0; if (d > 0 && hp > 0) return +(hp / d).toFixed(1); } catch { /* ignore */ } return (luta && luta.tKillS) != null ? luta.tKillS : null; })(), nPocoes, ouroPocao: nPocoes * 110 };
  };
  /** Ranking por SOBREVIVENCIA (F5-F9): cada candidato entra no conjunto base; ordena por `tMorrer`
   *  (o que da uma ordem DIFERENTE do `rankItens`, que e so DPS - o criterio novo do dono). */
  const rankItensSobrevivencia = (alvo, opt) => {
    const base = ((opt && opt.base) || readEquip().map((e) => e.base)).map(String);
    const rid = (opt && opt.regiaoId) || 'barao';
    const lista = (META.itens || []).map((x) => { const s1 = sobrevivenciaSet(base.concat([String(x.id)]), alvo, rid); return { id: String(x.id), sobrevive: s1.morre === false, tMorrer: s1.tMorrer, nPocoes: s1.nPocoes, ouroPocao: s1.ouroPocao }; });
    lista.sort((a, b) => (b.tMorrer || 0) - (a.tMorrer || 0));
    return lista;
  };

  /** Ficha de um item do meta (nome/raridade/preço/stats). */
  function infoItem(base, qual, refino) {
    const b = String(base == null ? '' : base).replace(/[+~].*$/, '');
    const it = (META.itens || []).find((x) => String(x.id) === b);
    if (!it) return {};
    // Sem `qual`/`refino` explícitos, usa a MELHOR instância conhecida (equipado/mochila): os stats
    // passam a ser os da peça real. Sem peça conhecida, B/0 = o catálogo cru (não se inventa).
    const peca = (qual == null || refino == null) ? pecaConhecida(b) : null;
    const q = qual == null ? (peca ? peca.qual : 'B') : String(qual).toUpperCase();
    const r = refino == null ? (peca ? peca.refino : 0) : +refino;
    const temPeca = qual != null || refino != null || !!peca;
    return { nome: it.nome, raridade: it.raridade, preco: it.preco,   // `preco` = BASE do catálogo
      qual: q, refino: r,
      // VALOR REAL da peça com refino e qualidade (motor.js:2898 e 257). Sem peça lida fica
      // null — não se inventa valor para uma peça que ninguém viu.
      valorEquip: temPeca ? valorEquip(b, q, r) : null,
      valorVenda: temPeca ? valorVenda(b, q, r) : null,
      // TK-02-79: os stats de QUALQUER item (equipado, mochila ou mercado), pela fórmula do
      // motor. Antes vinham de `it.stats`, campo que o catálogo não tem -> `stats: null`, e
      // quem consultava o infoItem para saber os atributos de um item recebia NADA.
      stats: statsDePeca(b, q, r), efeito: it.efeito || null };
  }
  /** NOME como o ECRÃ do jogo o mostra: 'Ímpeo Cósmico +3 [A]'. O motor escreve só '+N'
   *  (`nomeRef`, motor.js:253) — a qualidade no nome é o que o dono vê no ecrã. */
  function nomeCompleto(base, qual, refino) {
    const n = (infoItem(base) || {}).nome || String(base);
    const r = refino ? ' +' + refino : '';
    const q = qual && qual !== '?' ? ' [' + qual + ']' : '';
    return n + r + q;
  }

  /** ESTADO COMPLETO da conta: atributos, ouro, poções, equipado, mochila e resumo. */
  function estado() {
    const p = player();
    const mochila = scanBag();
    const equip = readEquip();
    const itens = (mochila?.items || []).map((it) => {
      if (it.kind === 'espolio') return { ...it, nome: 'espólio' };
      const info = infoItem(it.base);
      return { ...it, nome: nomeCompleto(it.base, it.qual, it.refino), preco: info.preco ?? null,
        valorEquip: valorEquip(it.base, it.qual, it.refino), valorVenda: valorVenda(it.base, it.qual, it.refino),
        protegido: isProtected(it), lixo: isTrash(it) };
    });
    const equipado = equip.map((e) => { const info = infoItem(e.base); return { ...e, nome: e.nome || nomeCompleto(e.base, e.qual, e.refino), preco: info.preco ?? null,
      valorEquip: valorEquip(e.base, e.qual, e.refino), valorVenda: valorVenda(e.base, e.qual, e.refino) }; });
    const conta = { ...p, ouro: readGold(), local: readLocation().text };
    const porRar = {}; for (const i of itens) { if (i.kind === 'item') porRar[i.raridade] = (porRar[i.raridade] || 0) + 1; }
    const porQual = {}; for (const i of itens) { if (i.kind === 'item') porQual[i.qual] = (porQual[i.qual] || 0) + 1; }
    return {
      conta, atributos: readStats(), pocoes: readPotions(), habilidades: readSkills(),
      equipado, mochila: mochila ? { cap: mochila.cap, used: mochila.used, espacosEspolio: mochila.espacosEspolio } : null,
      itens,
      resumo: {
        mochilaLivre: mochila ? mochila.cap - mochila.used : null,
        itemPorRaridade: porRar, itemPorQualidade: porQual,
        protegidos: itens.filter((i) => i.protegido).length, lixo: itens.filter((i) => i.lixo).length,
        ouro: readGold(), ouroItemProtegido: equipado.filter((e) => e.raridade === 'lendario').length,
      },
    };
  }

  // ------------------------------------------------------------- PAUSE (congela e recalcula)
  let pausado = false;
  let estadoPre = null, estadoPos = null;
  function snapshotEstado() {
    const hp = (typeof window !== 'undefined' && window.__lolidleLive?.hp) || null;
    return {
      at: Date.now(), local: readLocation().text, ouro: readGold(), pocoes: readPotions(),
      nivel: player().nivel, hp: hp ? { cur: hp.cur, max: hp.max } : null,
      mochila: (() => { try { const b = scanBag(); return b ? `${b.used}/${b.cap}` : null; } catch { return null; } })(),
      chefeFatal: (() => { const c = farm.current; if (!c) return null; const r = agregar().find((x) => x.region === c.region); return r?.risco?.morre ? c.boss : null; })(),
    };
  }
  function diffEstado(a, b) {
    if (!a || !b) return null;
    const d = {};
    if (a.local !== b.local) d.local = `${a.local} → ${b.local}`;
    if (a.ouro !== b.ouro) d.ouro = b.ouro - a.ouro;
    if (a.nivel !== b.nivel) d.nivel = `${a.nivel} → ${b.nivel}`;
    for (const k of ['vida', 'vidaF', 'vidaS']) { const x = (a.pocoes?.[k] || 0) - (b.pocoes?.[k] || 0); if (x) d['pot ' + k] = -x; }
    if (a.hp && b.hp && a.hp.cur !== b.hp.cur) d.hp = `${a.hp.cur} → ${b.hp.cur}`;
    if (a.mochila !== b.mochila) d.mochila = `${a.mochila} → ${b.mochila}`;
    d.segundos = Math.round((b.at - a.at) / 1000);
    return d;
  }
  // ================= KILL SWITCH + PAUSAR ≠ DESLIGAR (pedido do dono) ===================
  // O problema: `cfg.enabled=false` só travava o `tickAutoplay` — as acções de EQUIPAR,
  // ATRIBUTOS e SKILLS corriam fora desse portão, por isso "desligar" não desligava nada.
  // Agora há UM portão (`podeAgir`) e três controlos com semânticas DIFERENTES:
  //   PAUSAR   -> congela as ACÇÕES, continua a OBSERVAR (a medição acumula), retoma igual.
  //   DESLIGAR -> para TUDO e LIMPA o estado activo (prazos, throttles, farm forçado,
  //               backoff, testes). Ao religar começa limpo.
  //   KILL     -> igual a desligar, mas persistido: sobrevive a recarregar a página.
  const DESLIG_KEY = 'lolidleAuto:desligado';
  let desligado = false;
  try { desligado = localStorage.getItem(DESLIG_KEY) === '1'; } catch { /* ignore */ }

  /** Limpa TODO o estado activo — é o que faltava para "desligar" ser diferente de "pausar". */
  function limparEstadoAtivo() {
    pausado = false; _pausaAte = 0;
    _farmForcadoAte = 0;
    _ultimaVenda = 0; _ultimaBase = 0; _ultimaMontagem = 0;
    try { if (INDISPONIVEL && INDISPONIVEL.clear) INDISPONIVEL.clear(); } catch { /* ignore */ }
    return true;
  }
  /** DESLIGAR: para tudo, limpa o estado activo e PERSISTE (sobrevive a reload). */
  function desligarTudo(motivo) {
    desligado = true;
    try { localStorage.setItem(DESLIG_KEY, '1'); } catch { /* ignore */ }
    limparEstadoAtivo();
    logEvent('kill', { acao: 'desligar', motivo: motivo || 'manual' });
    return { ok: true, desligado: true };
  }
  /** RELIGAR: só a acção explícita do dono devolve o controlo. */
  function religarTudo() {
    desligado = false;
    try { localStorage.removeItem(DESLIG_KEY); } catch { /* ignore */ }
    limparEstadoAtivo();
    logEvent('kill', { acao: 'religar' });
    return { ok: true, desligado: false };
  }

  /** Pausa o script: congela as ações e guarda o estado atual. */
  function pausar() {
    if (pausado) return estadoPre;
    pausado = true;
    estadoPre = snapshotEstado();
    logEvent('pause', { acao: 'pausar', estado: estadoPre });
    return estadoPre;
  }
  /** Despausa: guarda o novo estado, compara com o de antes e recalcula os dados. */
  function despausar() {
    if (!pausado) return null;
    pausado = false;
    estadoPos = snapshotEstado();
    const diff = diffEstado(estadoPre, estadoPos);
    let recomp = null; try { recomp = recomendar(); } catch { /* ignore */ }
    logEvent('pause', { acao: 'despausar', antes: estadoPre, depois: estadoPos, diff, recomendar: recomp });
    marcarAtiva();
    return { antes: estadoPre, depois: estadoPos, diff, recomenda: recomp };
  }
  // PAUSA COM PRAZO (fix estrutural): um `pausar()` sem prazo ficava PRESO quando o fluxo
  // que o pediu morria a meio — foi o que deixou a automação parada e o ouro a cair 13.300
  // (HANDOFF §9.6x). `pausarPor(ms)` retoma sozinha, e a expiração é verificada no próprio
  // `estaPausado()`, portanto vale em TODOS os pontos que consultam a pausa.
  let _pausaAte = 0;
  function pausarPor(ms) {
    pausar();
    _pausaAte = Date.now() + Math.max(1000, Math.min(600000, Number(ms) || 60000));
    return { ok: true, retomaEmMs: _pausaAte - Date.now() };
  }
  /** PORTÃO ÚNICO de escrita: qualquer acção que mexa no jogo tem de passar por aqui.
   *  Usa isto (e não `estaPausado`) nos pontos de execução — foi por as acções correrem
   *  FORA do portão que "desligar" não desligava nada. */
  const podeAgir = () => !desligado && !estaPausado();

  const estaPausado = () => {
    if (desligado) return true;                    // KILL SWITCH: tudo parado, sempre
    if (pausado && _pausaAte && Date.now() > _pausaAte) {
      pausado = false; _pausaAte = 0;
      logEvent('pause', { acao: 'auto-retoma', motivo: 'prazo de pausarPor expirou' });
    }
    return pausado;
  };

  // ------------------------------------------------------------- vigilância (AFK + novidades)
  let ativaEm = Date.now();
  function marcarAtiva() { ativaEm = Date.now(); }
  const naBase = () => /fonte/i.test(readLocation().text || '');

  /** OBJETIVOS de farm aceitos. `ouro+xp` é o DEFAULT (regra do dono: "usar a que maximiza
   *  ouro+xp/min"). Qualquer valor desconhecido cai nele (ex.: a GUI ainda só oferece xp/ouro/
   *  runas — o select dela fica fora do meu scope). */
  const OBJETIVOS = ['ouro+xp', 'xp', 'ouro', 'runas'];
  const objDe = (v) => (OBJETIVOS.indexOf(v) >= 0 ? v : 'ouro+xp');
  /** TAXA DE TROCA xp<->ouro DO PRÓPRIO MOTOR: `CURVA.xp(n) = (30+7n)·ajuste(n).xp` e
   *  `CURVA.ouro(n) = (8+3,5n)·ajuste(n).ouro` (motor.js:277-278) — o MESMO monstro de nível n
   *  dá essas duas coisas, logo `xp(n)/ouro(n)` é quanto o motor considera que 1 de ouro vale
   *  em xp àquele nível. É esta a taxa que soma os dois eixos sem inventar pesos:
   *  `score = xp/min + ouro/min × taxa`. (No nível 15 dá ≈ 2,2 xp por 1 de ouro.) */
  function taxaXpOuro(nivel) {
    try { const c = curva(nivel || 1); return (c.ouro > 0) ? (c.xp / c.ouro) : 1; } catch { return 1; }
  }
  /** SCORE de uma região pelo objetivo — UMA função para o `regiaoIdeal` e o `rankRegioes`. */
  function scoreRegiao(e, obj, medido) {
    if (!e) return -Infinity;
    const o = objDe(obj);
    const xp = (medido && medido.xpMin != null) ? medido.xpMin : (e.xpMin || 0);
    const ouro = (medido && medido.goldMin != null) ? medido.goldMin : (e.goldMin || 0);
    if (o === 'xp') return xp;
    if (o === 'ouro') return ouro;
    if (o === 'runas') return e.runasH || 0;
    return xp + ouro * taxaXpOuro(e.mobLevel || 1);
  }
  /** Região "ABAIXO do nível" = o TOPO da faixa já ficou para trás (motor.js:421 `fatorXp`:
   *  monstro mais de 5 níveis abaixo rende −10% por nível, mínimo 10%). REGRA DO DONO:
   *  "nao ficar em regiao abaixo do nivel". */
  const abaixoDoNivel = (l, p) => !!(l && l.faixa && (p.nivel || 1) > l.faixa[1]);
  /** Região: a escolhida (cfg.regionDefault) ou a melhor p/ o nível (ouro + xp). */
  /** Runeterra é jogado MANUALMENTE — a automação nunca escolhe/visita essas regiões. */
  const ehRuneterra = (l) => /runeterra/i.test(semAcento((l && (l.nome || l.id)) || ''));

  function regiaoIdeal() {
    if (cfg.regionDefault) return cfg.regionDefault;
    const p = player();
    const obj = objDe(cfg.objetivo);
    // FILTRO FAIL-CLOSED (correcção do Lead, 2026-10-14): `!x.e.morte` tratava `undefined` (risco
    // NÃO calculado) como "segura" — era um NO-OP. Agora só passa quem PROVOU ser seguro
    // (`morte === false`). "Não se sabe" não pode mandar o boneco para a morte.
    const cand0 = (META.locais || []).filter((l) => !ehRuneterra(l)).map((l) => ({ l, e: estimarRegiao(l.id) })).filter((x) => x.e && x.e.morte === false);
    // REGRA DO DONO (7): "não ficar em região abaixo do nível". Aplicada como PREFERÊNCIA: se
    // TODAS estiverem abaixo do nível (ex.: nível 50 e a última faixa acaba no 50), não se
    // inventa uma região — usa-se o conjunto inteiro.
    const emNivel = cand0.filter((x) => !abaixoDoNivel(x.l, p));
    const cand = emNivel.length ? emNivel : cand0;
    if (!cand.length) logEvent('regiao', { motivo: 'sem regioes: META.locais vazio (sem meta)' }); return null;
    // NÃO MISTURAR MEDIDO COM TEORIA: a teoria SISTEMATICAMENTE sobrestima (Campo Azul mede
    // 4.719 xp/min contra 6.309 teóricos), por isso comparar as duas numa só ordenação faz a
    // teoria ganhar sempre — que era exactamente o bug. Se houver QUALQUER região com amostra
    // (n>=3), a decisão passa a ser feita SÓ entre as medidas; a teoria fica para quando não
    // há histórico nenhum.
    const doNivel0 = cand.filter((x) => (x.l.nm ? x.l.nm[0] : 99) <= p.nivel + 6);
    // MEDIDO MANDA (mesmo princípio do `melhorSet` no contexto 'mob'): a escolha da região
    // usava só a TEORIA (`estimarRegiao`), e por isso mandava-o para Campo Vermelho com base
    // num xp/min teórico — enquanto o histórico REAL dizia Campo Azul com 1.260 ouro/min e
    // 4.719 xp/min (n=8) contra 766/2.312 de Rota Superior. Sem isto, o empírico que existe
    // nunca chegava à decisão. Só usa o medido quando há amostra (n>=3); senão, teoria.
    let _medido = null;
    try { _medido = agregar() || []; } catch { _medido = []; }
    const medidoDe = (l) => {
      const alvo = semAcento((l && l.nome) || '');
      return (_medido || []).find((a) => { const r = semAcento(a.region || ''); return r && alvo && (r.indexOf(alvo) >= 0 || alvo.indexOf(r) >= 0); }) || null;
    };
    // MEDIDO MANDA quando há amostra (n>=3): o score passa a usar os números REAIS daquela
    // região. Com o objetivo combinado, soma-se xp e ouro MEDIDOS com a taxa do motor.
    const score = (x) => {
      const m = medidoDe(x.l);
      const usa = (m && (m.n || 0) >= 3) ? m : null;
      return scoreRegiao(x.e, obj, usa);
    };
    // (ordem importa: isto tem de vir DEPOIS de `medidoDe` — um const usado antes da
    //  inicialização dá ReferenceError/TDZ, que foi exactamente o que aconteceu)
    const _comAmostra = cand.filter((x) => { const m = medidoDe(x.l); return m && (m.n || 0) >= 3; });
    const base = _comAmostra.length ? _comAmostra : cand;
    const doNivel = doNivel0.filter((x) => base.indexOf(x) >= 0);
    (doNivel.length ? doNivel : base).sort((a, b) => score(b) - score(a));
    return (doNivel[0] || base[0])?.l.id || null;
  }

  /** A REGIÃO É SEGURA? (regra do dono: "NAO E PRA MORRER, NUNCA, COM ESSE SCRIPT")
   *  Correcção do Lead, 2026-10-14 — MEDIDO AO VIVO: a Katarina (nv 29) estava no COVIL DO
   *  BARÃO (faixa 40-50) e a rotina da base mandou-a DE VOLTA para lá. A memória
   *  `_regiaoAntesDaBase` não passava por validação nenhuma (a `regiaoIdeal()` filtra; a
   *  memória não filtrava nada). A memória é uma PREFERÊNCIA, nunca uma ordem.
   *  Critérios (os MESMOS dados que a `regiaoIdeal` usa, nada inventado):
   *    (a) não estar abaixo do nível do jogador (`abaixoDoNivel`);
   *    (b) o nível do jogador chegar ao MÍNIMO da faixa da região (não entrar em zona acima);
   *    (c) a estimativa PROVAR que sobrevive (`morte === false`, fail-closed) e
   *    (d) não haver risco de morte MEDIDO (`risco.morre` do histórico da região). */
  function regiaoSegura(id) {
    if (!id) return false;
    const l = (META.locais || []).find((x) => String(x.id) === String(id));
    if (!l) return false;
    const p = player();
    if (abaixoDoNivel(l, p)) return false;                                  // (a) abaixo do nível
    // (b) zona MUITO acima do boneco: usa a MESMA tolerância que o `doNivel0` da `regiaoIdeal`
    // (6 níveis). Sem tolerância nenhuma, uma zona a 1 nível do mínimo (o Fosso do Dragão
    // `nm:[30,38]` com o boneco a 29) seria recusada — e o jogo deixa-a jogar.
    const nivelMin = (l.nm && l.nm[0] != null) ? l.nm[0] : (l.faixa ? l.faixa[0] : null);
    if (nivelMin != null && (p.nivel || 1) + 6 < nivelMin) return false;
    let e = null; try { e = estimarRegiao(id); } catch { /* ignore */ }
    if (!e || e.morte !== false) return false;                              // (c) tem de PROVAR que sobrevive
    try {
      const r = (agregar() || []).find((x) => x.region && l.nome && String(x.region).startsWith(String(l.nome)));
      if (r && r.risco && r.risco.morre) return false;                      // (d) risco medido de morte
    } catch { /* ignore */ }
    return true;
  }

  /** Ranking de regiões pelo objetivo (ouro+xp/xp/ouro/runas) — usado pela GUI e pelo planner. */
  function rankRegioes(obj) {
    obj = objDe(obj || cfg.objetivo);
    return (META.locais || []).filter((l) => !ehRuneterra(l)).map((l) => {
      let e = null; try { e = estimarRegiao(l.id); } catch { /* ignore */ }
      if (!e) return null;
      return { id: l.id, nome: (l.nome || '').replace(/ nível.*/, ''), xpMin: e.xpMin, goldMin: e.goldMin, runasH: e.runasH, morte: e.morte,
        // `sobrevive` explícito (correcção do Lead, 2026-10-14): uma região onde o boneco MORRE
        // não pode aparecer em #1 com a taxa teórica. Fica listada (a GUI mostra-a) mas com
        // `sobrevive:false`, `riscoMob` e o `score` que a põe ABAIXO das que ele sobrevive.
        sobrevive: e.morte === false, riscoMob: e.riscoMob, riscoDps: e.riscoDps,
        mobLevel: e.mobLevel, abaixoDoNivel: abaixoDoNivel(l, player()), score: Math.round(scoreRegiao(e, obj, null)),
        chefe: l.chefe ? l.chefe[0] : null };
    }).filter(Boolean).sort((a, b) => (Number(b.sobrevive) - Number(a.sobrevive)) || (b.score - a.score));
  }

  /** Poção baixa → volta à base e repõe. EXCEÇÃO: se está no CHEFE e o que temos
   *  cobre a estimativa (estimarLuta.potTotal), TERMINA o chefe primeiro. */
  let reporAte = 0;
  function checarPocoes() {
    if (!podeFazer('manutencao').pode || pausado) return;   // base = manutencao (vender/cofre/repor)
    if (Date.now() < reporAte) return;
    // MODO FARM FORÇADO (3 visitas à base sem fechar nada): não se recorda por poções — é o
    // caminho que alimentava o ciclo de recall quando a loja não vendia o que ele pedia.
    if (Date.now() < _farmForcadoAte) return;
    const p = readPotions();
    // Só considera poções que a LOJA VENDE ao nível dele (`pocaoCompravel`, motor.js:261-267) e
    // mede contra o mínimo que conta (`minimoPocoesAgora`).
    const falta = ['vidaS', 'vidaF', 'vida'].filter((k) => (p[k] || 0) < minimoPocoesAgora()[k] && pocaoCompravel(k));
    if (!falta.length) return;
    const c = farm.current;
    if (c && c.fase === 'boss' && c.boss) {
      let est = null; try { est = estimarLuta(localId(c.region)); } catch { /* ignore */ }
      if (est && est.ganha && est.potTotal != null) {
        const temos = (p.vida || 0) * HEALVAL.vida + (p.vidaF || 0) * HEALVAL.vidaF + (p.vidaS || 0) * HEALVAL.vidaS;
        const precisa = est.potTotal * Math.max(1, curaPocaoMax());
        if (temos >= precisa) { logEvent('repor', { adiado: 'chefe', falta, temos, precisa, potTotal: est.potTotal }); return; }
      }
    }
    reporAte = Date.now() + 15 * 60000;   // trava: no MÁX 1 reposição a cada 15 min (evita loop/gasto)
    logEvent('repor', { motivo: 'poção baixa', falta, atual: p });
    if (naBase()) { acaoBase().catch(() => { /* ignore */ }); return; }
    press('b');
    setTimeout(() => { try { if (naBase()) acaoBase().catch(() => { /* ignore */ }); } catch { /* ignore */ } }, esperaRecallMs());
  }

  /** Se ficou parado na base além de `cfg.idleBaseMs` (3 min), volta a farmar sozinho. */
  let _ultimaVenda = 0, _ultimaTarefa = 0, _baseBusy = false, _ultimaBase = 0, _ultimaCompra = 0, _baseFalhas = 0;
  /** MODO FARM FORÇADO: 3 visitas seguidas à base SEM fechar NENHUMA necessidade = a base não
   *  tem o que ele precisa. Em vez de continuar a andar para trás e para a frente (a queixa
   *  do dono), ignora-se a base por `FARM_FORCADO_MS` e farma-se — com o motivo no log. */
  let _recallsSemFechar = 0, _farmForcadoAte = 0;
  const FARM_FORCADO_MS = 10 * 60 * 1000;   // 10 min
  let ocupado = false;   // operação em andamento (mercado/loja) → NUNCA viajar no meio
  function supervisarBase() {
    if (!podeFazer('manutencao').pode || pausado) return;   // base = manutencao (vender/cofre/repor)
    // Avalia a NECESSIDADE (vale na base E no campo): mochila cheia, tarefa pronta, lixo, sem tarefa
    let motivo = null, info = {}, querTarefa = false, falta = [], necess = null;
    try {
      const bag = scanBag();
      const st = tarefaEstado();
      const semTarefa = !st.tem;
      querTarefa = semTarefa && Date.now() - _ultimaTarefa > 300000;
      // FONTE ÚNICA DA VERDADE: `necessidadesBase()` — a MESMA que o `acaoBase` usa (PASSOS_BASE).
      // Antes havia aqui um critério PARALELO (mochila cheia / lixo>=1 / tarefa) e era essa
      // duplicação que fazia o supervisor mandar vender 1 item enquanto o planeador achava que
      // não valia a pena. Agora o motivo É a lista de necessidades que PAGAM a viagem.
      try { necess = necessidadesBase(); falta = faltandoNaBase(necess); } catch { falta = []; }
      info = { used: bag && bag.used, cap: bag && bag.cap, falta, venda: necess && necess._venda, custoIda: necess && necess._custoIda, pocoes: necess && necess._pocoes };
      motivo = falta.length ? ('base: ' + falta.join(',')) : null;
    } catch { /* ignore */ }

    if (naBase()) {
      // MODO FARM FORÇADO: sai da base e farma, mesmo com necessidade pendente (ver
      // `_farmForcadoAte`). É a saída de emergência do ciclo de recall — e LOGA o motivo.
      if (Date.now() < _farmForcadoAte) {
        if (ocupado || _baseBusy || baseLock) return;
        if (Date.now() - _ultimaBase < 20000) return;
        _ultimaBase = Date.now();
        const regF = regiaoIdeal();
        if (regF) { logEvent('base', { farmar: 'FORCADO (modo farm — a base não fecha o que falta)', regiao: regF, falta, restaMin: Math.ceil((_farmForcadoAte - Date.now()) / 60000) }); marcarAtiva(); viajarPara(regF); }
        return;
      }
      // NA BASE com algo pendente → roda a rotina AGORA (antes só esperava o AFK de 3 min)
      if (motivo && !_baseBusy && Date.now() - _ultimaBase > 20000) {
        _ultimaBase = Date.now(); if (querTarefa) _ultimaTarefa = Date.now();
        _baseBusy = true;
        // MOTIVO COM VALOR (pedido do Lead): o dono tem de ver PORQUE é que ele foi à base,
        // quanto é que isso vale (`venda.valor`) e quanto é que a viagem CUSTA (`custoIda`).
        logEvent('base', { ir: 'ja na base: ' + motivo, ...info });
        let res = null;
        acaoBase().then((r) => { res = r; }).catch(() => { /* ignore */ }).finally(() => {
          _baseBusy = false;
          // CAUSA (3) DO P0: RE-VERIFICA as necessidades ANTES de viajar. O `res.ok` já vem da
          // re-leitura final do `acaoBase`, mas esta leitura apanha o que APARECEU depois dela
          // (uma tarefa que ficou pronta, lixo novo, pontos de skill/atributo). Sem isto o
          // boneco saía da base a meio e voltava segundos depois — a queixa do dono.
          let faltaAgora = [];
          try { faltaAgora = faltandoNaBase(); } catch { /* ignore */ }
          // SÓ volta a farmar se a rotina da base REALMENTE concluiu E nada falta.
          // `podeFazer('autoplay')` em vez de `cfg.enabled` (correcção do Lead, 2026-10-14):
          // o actor pergunta à HIERARQUIA — viajar para farmar é auto-play, e o auto-play tem
          // a excepção de campeão. Era este portão directo que deixava a Katarina (enabled=false,
          // manutencao=true) sair da base a viajar para o Covil do Barão (40-50) aos 29.
          if (res && res.ok && !faltaAgora.length && podeFazer('autoplay').pode && !ocupado && !pausado && !baseLock) {
            _baseFalhas = 0; _recallsSemFechar = 0;
            // VOLTAR PARA ONDE ESTAVA (regra implicita do dono): prefere a regiao onde ele
            // estava ANTES de ir a base — MAS SÓ SE A ZONA FOR SEGURA (ver `regiaoSegura`).
            // A memória é PREFERÊNCIA, nunca ordem: zona letal cai na `regiaoIdeal()`.
            const memSegura = (_regiaoAntesDaBase && regiaoSegura(_regiaoAntesDaBase)) ? _regiaoAntesDaBase : null;
            if (_regiaoAntesDaBase && !memSegura) logEvent('base', { memoriaDescartada: _regiaoAntesDaBase, motivo: 'regiao nao segura (nivel/faixa/risco de morte)' });
            const reg = memSegura || regiaoIdeal();
            if (reg) { logEvent('base', { voltarPara: reg, fonte: memSegura ? 'onde estava' : 'regiao ideal' }); viajarPara(reg); }
          } else {
            _baseFalhas++;
            logEvent('base', { farmar: 'NAO (base incompleta)', ok: res && res.ok, motivo: (res && res.motivo) || null, falta: faltaAgora, restou: (res && res.restou) || null, passagens: res && res.passagens, fechou: res && res.fechou, falhas: _baseFalhas });
            // TECTO DE RECALLS (P0 ao vivo): 3 visitas seguidas SEM fechar NENHUMA necessidade =
            // a base não tem o que ele precisa. Entra em MODO FARM FORÇADO e diz PORQUE no log
            // (o dono tem de ver "não consigo comprar X, vou farmar", não ping-pong silencioso).
            if (res && (res.fechou || 0) <= 0) {
              _recallsSemFechar++;
              if (_recallsSemFechar >= 3) {
                _recallsSemFechar = 0;
                _farmForcadoAte = Date.now() + FARM_FORCADO_MS;
                const reg = regiaoIdeal();
                logEvent('base', { farmar: 'FORCADO (3 visitas sem fechar nada — modo farm)', regiao: reg, falta: faltaAgora, restou: (res && res.restou) || null, minutos: FARM_FORCADO_MS / 60000 });
                if (reg && podeFazer('autoplay').pode && !ocupado && !pausado && !baseLock) { marcarAtiva(); viajarPara(reg); }   // hierarquia, não cfg.enabled
                return;
              }
            } else { _recallsSemFechar = 0; }
            // REDE DE SEGURANÇA: uma base que falha sempre não pode condenar o boneco
            // a ficar parado. Ao 3.º fracasso seguido vai farmar de qualquer maneira.
            if (_baseFalhas >= 3) {
              _baseFalhas = 0;
              const reg = regiaoIdeal();
              if (reg) { logEvent('base', { farmar: 'FORCADO apos 3 falhas', regiao: reg }); marcarAtiva(); viajarPara(reg); }
            } else {
              // NÃO viaja e liberta JÁ o throttle de entrada: o próximo tick (5 s) volta a correr
              // a base. É isto que impede o "sai e volta segundos depois" — ele NÃO sai.
              _ultimaBase = 0;
            }
          }
        });
        return;
      }
      // sem pendência: AFK (parado na Fonte 3 min) → volta a farmar
      if (ocupado || _baseBusy || baseLock) return;   // NUNCA viajar com a base em andamento
      // ...e NUNCA com necessidade pendente. Se a lista do início do tick não estava vazia mas o
      // ramo de cima não correu (throttle de 20 s), liberta-se o throttle e a base roda já.
      if (falta.length) { _ultimaBase = 0; logEvent('base', { farmar: 'NAO (falta ' + falta.join(',') + ')', falta }); return; }
      if (Date.now() - ativaEm < (cfg.idleBaseMs || 180000)) return;
      // PORTÃO QUE FALTAVA (correcção do Lead, 2026-10-14): este ramo viajava para farmar SEM
      // perguntar nada — era o caminho que, com o auto-play desligado, punha a Katarina a
      // caminho de uma zona letal. Viajar para farmar é AUTO-PLAY: pergunta-se à hierarquia.
      if (!podeFazer('autoplay').pode) return;
      const reg = regiaoIdeal();
      if (!reg) return;
      logEvent('afk-farmar', { regiao: reg, paradoMin: Math.round((Date.now() - ativaEm) / 60000) });
      marcarAtiva();
      viajarPara(reg);
    } else if (!teste && motivo && Date.now() < _farmForcadoAte) {
      // MODO FARM FORÇADO no campo: NÃO recorda (era este o `press('b')` que fechava o ciclo
      // "viaja, mata 1 mob, volta"). Fica a farmar e marca-se activo.
      marcarAtiva();
    } else if (!teste && motivo && Date.now() - _ultimaVenda > 20000) {
      _ultimaVenda = Date.now(); if (querTarefa) _ultimaTarefa = Date.now();
      // MOTIVO COM VALOR: `venda:{itens,valor}` + `custoIda:{ouro,seg}` — o dono vê a conta.
      logEvent('base', { ir: motivo, ...info });
      press('b');
      setTimeout(() => { try { if (naBase()) acaoBase(); } catch { /* ignore */ } }, esperaRecallMs());
    } else {
      marcarAtiva();                                              // no mapa = ativo
    }
  }

  /** TICK do auto-play — UM ponto de entrada para fazer o ciclo andar.
   *  Porque existe: os setInterval registados na injecao do content script
   *  podem ficar MORTOS (medido: 8 ids em __lolidleAutoTimers, plano 101 s sem
   *  avancar, e no entanto um setInterval novo no mesmo mundo dispara 6x/6s).
   *  Sem tick, o auto-play para e o boneco fica na base sem uma linha de log.
   *  Cada funcao tem o seu proprio throttle interno, por isso chamar isto com
   *  frequencia e seguro e idempotente. */
  let _ultimoTick = 0;
  function tickAutoplay() {
    _ultimoTick = Date.now();
    const feito = [];
    // DIÁLOGO PRESO (bug medido): um modal de confirmação (ex.: "Ir ao Lojista") ficou aberto
    // e passou a engolir TODAS as teclas — o `press('m')` deixou de abrir o mapa, o `viajarPara`
    // falhava em silêncio e o boneco ficou PARADO na Fonte com o ouro a não subir durante 8+
    // minutos. O `fecharJanelas()` não o apanha (o botão é `.botao.dialogo-ok`, não `[data-fechar]`).
    // Aqui fecha-se sozinho, no caminho quente, antes de qualquer outra coisa.
    try {
      const ok = document.querySelector('.botao.dialogo-ok');
      if (ok && ok.getBoundingClientRect().width > 0) {
        logEvent('dialogo', { auto: true, txt: (ok.textContent || '').trim().slice(0, 40) });
        ok.click();
      }
    } catch { /* ignore */ }
    try { loop(); feito.push('loop'); } catch (e) { logIssue('tick:loop', { erro: String(e) }); }
    try { supervisarBase(); feito.push('supervisarBase'); } catch (e) { logIssue('tick:base', { erro: String(e) }); }
    try { checarPocoes(); feito.push('checarPocoes'); } catch (e) { logIssue('tick:pocoes', { erro: String(e) }); }
    try { checarRotacao(); feito.push('checarRotacao'); } catch (e) { logIssue('tick:rotacao', { erro: String(e) }); }
    try { checarFiltroBasicos().catch(() => { /* ignore */ }); feito.push('checarFiltroBasicos'); } catch (e) { logIssue('tick:filtro-basicos', { erro: String(e) }); }
    try { checarItens().catch(() => { /* ignore */ }); feito.push('checarItens'); } catch (e) { logIssue('tick:itens', { erro: String(e) }); }
    if (teste && !pausado) { try { passoTeste().catch(() => { /* ignore */ }); feito.push('passoTeste'); } catch (e) { /* ignore */ } }
    return { feito, at: _ultimoTick };
  }
  /** Saude do auto-play: o tick foi chamado nos ultimos N segundos? */
  function saudeAutoplay() { return { ultimoTickHaMs: _ultimoTick ? Date.now() - _ultimoTick : null, timers: (window.__lolidleAutoTimers || []).length, enabled: cfg.enabled, pausado }; }

  /** DIAGNOSTICO da base: PORQUE o auto-play esta (ou nao) a sair da Fonte.
   *  Cada early-return do supervisarBase era invisivel: o boneco ficava parado na
   *  base sem uma unica linha de log e sem forma de saber qual guarda barrava.
   *  Este diagnostico reproduz as MESMAS guardas e devolve qual esta a travar. */
  function diagnosticoBase() {
    let motivo = null, info = {}, erroMotivo = null, falta = [];
    try {
      const bag = scanBag();
      // MESMA FONTE DO `supervisarBase`: a lista de necessidades (não um critério paralelo).
      // Sem isto o diagnóstico dizia "lixo p/ vender" para 1 item — que é exactamente o que
      // o supervisor JÁ NÃO faz (a ida à base tem de pagar a viagem).
      let necess = null;
      try { necess = necessidadesBase(); falta = faltandoNaBase(necess); } catch { falta = []; }
      info = { used: bag && bag.used, cap: bag && bag.cap, falta, venda: necess && necess._venda, custoIda: necess && necess._custoIda, pocoes: necess && necess._pocoes, indisponivel: Object.keys(_indisponivel) };
      motivo = falta.length ? ('base: ' + falta.join(',')) : null;
    } catch (e) { erroMotivo = String(e); }
    let reg = null, erroReg = null;
    try { reg = regiaoIdeal(); } catch (e) { erroReg = String(e); }
    const idleMs = Date.now() - ativaEm;
    const idleBaseMs = cfg.idleBaseMs || 180000;
    const trava = [];
    if (!cfg.enabled) trava.push('enabled=false');
    if (pausado) trava.push('pausado');
    if (!naBase()) trava.push('nao-esta-na-base');
    if (ocupado) trava.push('ocupado (mercado/loja em andamento)');
    if (_baseBusy) trava.push('_baseBusy (rotina da base a correr)');
    if (baseLock) trava.push('baseLock (MUTEX preso)');
    if (idleMs < idleBaseMs) trava.push('idle ' + Math.round(idleMs / 1000) + 's < ' + Math.round(idleBaseMs / 1000) + 's');
    if (!reg) trava.push('sem regiao ideal');
    return { enabled: cfg.enabled, pausado, naBase: naBase(), motivo, info, erroMotivo, idleMs, idleBaseMs, regiaoIdeal: reg, erroReg, ocupado, _baseBusy, baseLock, baseFalhas: _baseFalhas, ultimaBaseHaMs: _ultimaBase ? Date.now() - _ultimaBase : null, teste, trava };
  }

  /** Fecha sozinha a janela de novidades quando ela abre SEM clique do usuário (pós-reinício). */
  let novidadesCliqueEm = 0;
  function cuidarNovidades() {
    document.addEventListener('click', (e) => {
      const t = e.target;
      if (t && t.closest && t.closest('#abrir-novidades')) novidadesCliqueEm = Date.now();
    }, true);
    const tentar = () => {
      const f = document.querySelector('.novidades-fundo');
      if (!f || f.dataset.lolidleAuto) return;
      f.dataset.lolidleAuto = '1';
      if (Date.now() - novidadesCliqueEm < 3000) return;          // o usuário abriu → deixa
      const btn = f.querySelector('header .fechar') || f.querySelector('.fechar') || f.querySelector('.novidades-ok');
      if (btn) { logEvent('novidades', { acao: 'auto-fechada', motivo: 'abriu sozinha (pós-reinício)' }); btn.click(); }
    };
    new MutationObserver(tentar).observe(document.documentElement, { childList: true, subtree: true });
    setInterval(tentar, 1500);
  }

  // =======================================================================================
  // PRIMEIRA VEZ DO SCRIPT/CONTA — o auto-play liga-se SOZINHO uma única vez
  // =======================================================================================
  // PEDIDO DO DONO (2026-10-14, verbatim): "em uma nova conta, o script deve ativar autoplay
  // depois de 3 minutos SE FOR A PRIMEIRA VEZ DA CONTA/DO SCRIPT INSTALADO. se a conta tem o
  // nome 'convidado', auto play e ativado por padrao. agora, pra mim, que nao e a primeira vez
  // do script, o auto play e desligado por padrao."
  //
  // AS QUATRO REGRAS:
  //   1. conta 'convidado' -> liga JÁ, sem esperar o prazo;
  //   2. primeira vez       -> liga SOZINHO `cfg.primeiraVezSeg` (180 s = 3 min) depois de a
  //                            EXTENSÃO carregar;
  //   3. conta conhecida    -> não liga nada (é o que já acontecia: `enabled:false` por defeito);
  //   4. a MARCA (`lolidleAutoPotion:instalado`) é escrita quando a primeira vez é CONSUMIDA —
  //      se já existir, NUNCA mais se liga sozinho (a marca guarda as contas que a consumiram).
  //
  // "PRIMEIRA VEZ" = do SCRIPT **ou** da CONTA (o dono escreveu "DA CONTA/DO SCRIPT INSTALADO"):
  //   - do SCRIPT: o storage não tem NENHUMA chave do motor (ver `CHAVES_JA_CORREU`). É isto que
  //     protege o dono no dia em que esta versão chega: o perfil dele já tem `:farm`/`:meta`/
  //     `:agregado` das corridas anteriores, logo NÃO é primeira vez e nada liga sozinho;
  //   - da CONTA: a marca JÁ EXISTE e o nome lido do HUD não está na lista `contas` dela — é uma
  //     conta NOVA neste perfil. (Com a marca ausente a lista está vazia e "o nome não está na
  //     lista" não prova nada: seria ligar sozinho na conta do dono, que é o que ele proibiu.)
  //
  // O ÚNICO campo que isto mexe é o interruptor-mestre `cfg.enabled`. A REGRA DE CAMPEÃO MANDA
  // SEMPRE: `podeFazer('autoplay')` tem a excepção `!ehCampeaoAlvo()` (INTERRUPTORES, ver
  // `autoplay` na tabela acima), logo ligar `enabled` num campeão que não o `champAlvo` NÃO abre
  // nada do auto-play (farmar/viajar/chefes/barra por fase). A MANUTENÇÃO — que já nascia ligada e
  // não depende do mestre — continua a fazer exactamente o que fazia.
  const INSTALADO_KEY = STORAGE_KEY + ':instalado';
  /** Chaves que só existem se o MOTOR já correu neste perfil — todas escritas pelo automation.js:
   *  a config (`setConfig`), o farm (FARM_KEY), o meta (META_KEY), o agregado (AGG_KEY), o plano
   *  (PLAN_KEY), o cofre, as ofertas, os testes e o giro.
   *  FICAM DE FORA as chaves de OUTROS scripts do projeto — `:status` (content.js) e `:reload`
   *  (background.js) aparecem no 1.º segundo de vida e fariam uma instalação NOVA parecer usada. */
  const CHAVES_JA_CORREU = [STORAGE_KEY, PLAN_KEY, FARM_KEY, META_KEY, AGG_KEY,
    STORAGE_KEY + ':cofre', STORAGE_KEY + ':ofertas', STORAGE_KEY + ':testes', STORAGE_KEY + ':giro'];

  let _pvInicio = Date.now();       // quando a EXTENSÃO carregou (o prazo dos 3 min conta daqui)
  let _pvCarregado = false;         // a marca do storage já foi lida?
  let _pvDecidido = false;
  let _pvTimer = null;
  let _pvContas = [];               // nomes de conta já vistos (da marca)
  let _pvTemMarca = false;          // a marca já existe (a primeira vez já foi consumida alguma vez)
  let _pvPrimeiraScript = false;
  let _pvMexeu = false;             // o dono mexeu no interruptor-mestre ANTES do prazo
  let _pvAuto = false;              // guarda: escrita feita pelo PRÓPRIO motor (`setConfig`)
  let _pvUltimo = null;             // último resultado (para a GUI/diagnóstico)

  /** Nome da conta como o JOGO o mostra.
   *  FONTE PRIMÁRIA — o HUD: `#st-nome` (jogo.js:240 `$('#st-nome').textContent = NOME`), o
   *  MESMO elemento onde a GUI pendura o hover do painel (gui.js:659, `nomeEl()`).
   *  FONTE DE CONTROLO — o título da página: jogo.js:252 `document.title = NOME + ' · LoL Idle'`.
   *
   *  PORQUE HÁ UMA GUARDA NO TÍTULO (MEDIÇÃO): o banco de regressão executa este ficheiro num DOM
   *  stubado com um VOCABULÁRIO FECHADO de seletores (tools/testes/dom-stub.mjs) e conta CADA
   *  seletor desconhecido como `UNSTUBBED` = FALHA. `#st-nome` não está nesse vocabulário e a
   *  página do banco não tem título; logo o `#st-nome` só é consultado quando a página se
   *  identifica como o JOGO (título publicado). No jogo lê-se o HUD (a fonte primária); no banco
   *  não se abre um buraco novo. A leitura é uma string barata e é repetida pelo vigia até o jogo
   *  se identificar — a `conectar()` do jogo é ASSÍNCRONA (jogo.js:39), o título vem depois dela. */
  function lerNomeConta() {
    let nome = '', fonte = null;
    try {
      const t = String(document.title || '');
      if (!t) return { nome: '', fonte: 'sem-titulo' };             // a página ainda não se identificou como o jogo
      const m = /^(.*?)\s*·\s*LoL Idle\s*$/i.exec(t);
      if (m) { nome = m[1]; fonte = 'titulo'; }                     // jogo.js:252
      try {
        const el = document.querySelector('#st-nome');              // jogo.js:240 (HUD)
        const txt = el ? String(el.textContent || '').replace(/\s+/g, ' ').trim() : '';
        if (txt) { nome = txt; fonte = 'hud'; }
      } catch { /* ignore */ }
    } catch { /* ignore */ }
    return { nome: String(nome).trim(), fonte };
  }
  /** A conta é 'convidado'? Regra do dono: "se a conta tem o nome 'convidado'".
   *  PROVA INDEPENDENTE no DOM: o jogo injeta `#aviso-convidado` em `#painel-status .corpo`
   *  quando a sessão é de convidado (jogo.js:2975-2978) — uma das duas provas chega. */
  function ehContaConvidado(nome) {
    if (/^convidado$/i.test(String(nome || '').trim())) return true;
    try { return !!document.querySelector('#aviso-convidado'); } catch { return false; }
  }
  /** Escreve a MARCA de "já foi a primeira vez" e regista a conta que a consumiu. */
  function marcarInstalado(extra) {
    const lido = lerNomeConta();
    const chave = lido.nome.toLowerCase();
    if (chave && _pvContas.indexOf(chave) < 0) _pvContas.push(chave);
    const marca = { at: Date.now(), nome: lido.nome || null, contas: _pvContas.slice(),
      via: (extra && extra.via) || null, ligou: !!(extra && extra.ligou) };
    try { chrome.storage.local.set({ [INSTALADO_KEY]: marca }); } catch { /* ignore */ }
    _pvUltimo = marca;
    return marca;
  }
  /** Liga o interruptor-mestre pelo MESMO caminho da GUI (`setConfig`) e consome a primeira vez.
   *  Não força nada além do `enabled`: a excepção de campeão continua a mandar (ver o bloco acima). */
  function ligarAutoPlayPrimeiraVez(via) {
    const antes = cfg.enabled;
    if (cfg.enabled !== true) {
      _pvAuto = true;
      try { setConfig({ enabled: true }); } finally { _pvAuto = false; }
    }
    const marca = marcarInstalado({ via, ligou: cfg.enabled === true });
    try {
      logEvent('primeira-vez', { via, antes: !!antes, agora: !!cfg.enabled, conta: marca.nome,
        champ: (META.champAtual || {}).id || null, alvo: cfg.champAlvo === undefined ? 'yasuo' : cfg.champAlvo,
        campeaoAlvo: ehCampeaoAlvo() });
    } catch { /* ignore */ }
    return { ok: true, ligado: cfg.enabled === true, via, conta: marca.nome };
  }
  /** UM passo da decisão. O vigia chama isto a cada 5 s até a decisão ficar tomada.
   *  Devolve o que fez — é o que a GUI mostra (`primeiraVez()`), para o dono poder ver PORQUE é
   *  que o auto-play se ligou (ou não). */
  function primeiraVezPasso() {
    if (_pvDecidido) return { decidido: true, ...(_pvUltimo || {}), contas: _pvContas.slice() };
    if (!_pvCarregado) return { decidido: false, motivo: 'a ler a marca do storage' };
    const lido = lerNomeConta();
    // Só decide em página IDENTIFICADA como o jogo: título no formato do jogo (`fonte:'titulo'`)
    // ou o nome lido do HUD (`fonte:'hud'`). Numa página do lolidle.com que não seja o jogo, isto
    // NÃO liga nada (fica a tentar) — nunca se liga auto-play "às cegas".
    if (lido.fonte !== 'hud' && lido.fonte !== 'titulo') return { decidido: false, motivo: 'a página ainda não se identificou como o jogo' };
    const nome = lido.nome, chave = nome.toLowerCase();
    const convidado = ehContaConvidado(nome);
    // 'PRIMEIRA VEZ DA CONTA' só existe quando a marca JÁ EXISTE e o nome de agora não está na
    // lista dela: é uma conta NOVA neste perfil (o dono: "em uma nova conta, o script deve ativar
    // autoplay depois de 3 minutos SE FOR A PRIMEIRA VEZ DA CONTA"). Com a marca AUSENTE a lista
    // está vazia e "o nome não está na lista" não prova nada — era esse o furo que fazia a conta
    // do dono (perfil já usado, marca ainda por criar) passar por conta nova e ligar sozinha.
    const primeiraDaConta = _pvTemMarca && !!chave && _pvContas.indexOf(chave) < 0;
    const primeira = _pvPrimeiraScript || primeiraDaConta;
    const contexto = { conta: nome, fonte: lido.fonte, convidado, primeira, primeiraScript: _pvPrimeiraScript, primeiraDaConta };
    if (cfg.autoLigarPrimeiraVez === false) {
      _pvDecidido = true;
      return { decidido: true, motivo: 'autoLigarPrimeiraVez=false (desligado pelo dono)', ...contexto };
    }
    if (!convidado && !primeira) {
      // CONTA CONHECIDA (ex.: a do dono): auto-play DESLIGADO por defeito — é o que já acontecia.
      // Regista a conta na marca para uma conta NOVA deste perfil ser reconhecida como nova.
      _pvDecidido = true;
      if (chave) marcarInstalado({ via: 'conta-conhecida', ligou: false });
      return { decidido: true, motivo: 'conta conhecida (nem primeira vez, nem convidado): não liga', ...contexto };
    }
    // CONVIDADO não espera; PRIMEIRA VEZ espera `cfg.primeiraVezSeg` desde o carregamento.
    const espera = convidado ? 0 : Math.max(0, numOr(cfg.primeiraVezSeg, 180) * 1000 - (Date.now() - _pvInicio));
    _pvDecidido = true;
    const via = convidado ? 'convidado' : 'primeira-vez';
    if (_pvMexeu) { marcarInstalado({ via: 'dono-mexeu', ligou: false }); return { decidido: true, motivo: 'o dono mexeu no interruptor-mestre antes do prazo', ...contexto }; }
    if (espera <= 0) return { decidido: true, ...ligarAutoPlayPrimeiraVez(via), ...contexto };
    _pvTimer = setTimeout(() => {
      _pvTimer = null;
      if (_pvMexeu) { marcarInstalado({ via: 'dono-mexeu', ligou: false }); logEvent('primeira-vez', { via: 'dono-mexeu', conta: nome }); return; }
      ligarAutoPlayPrimeiraVez(via);
    }, espera);
    try { logEvent('primeira-vez', { via, agendado: true, esperaMs: espera, ...contexto }); } catch { /* ignore */ }
    return { decidido: true, agendado: true, esperaMs: espera, ...contexto };
  }
  /** Arranque: lê a marca + o que prova que o motor já correu, e liga o vigia. */
  function primeiraVezIniciar() {
    _pvInicio = Date.now();
    try {
      chrome.storage.local.get([INSTALADO_KEY, ...CHAVES_JA_CORREU], (r) => {
        const marca = r && r[INSTALADO_KEY];
        _pvContas = (marca && Array.isArray(marca.contas)) ? marca.contas.map((x) => String(x).toLowerCase()).filter(Boolean) : [];
        if (marca && typeof marca.nome === 'string' && marca.nome) { const c = marca.nome.toLowerCase(); if (_pvContas.indexOf(c) < 0) _pvContas.push(c); }
        _pvTemMarca = !!marca;
        // "PRIMEIRA VEZ DO SCRIPT": nenhuma chave do motor no storage E nenhuma marca. Com a
        // marca presente a primeira vez JÁ foi consumida — a marca é o travao (regra 4 do dono).
        // `:instalado` não entra em `CHAVES_JA_CORREU`: é a própria marca desta funcionalidade.
        _pvPrimeiraScript = !_pvTemMarca && !CHAVES_JA_CORREU.some((k) => r && Object.prototype.hasOwnProperty.call(r, k));
        _pvCarregado = true;
      });
    } catch { _pvCarregado = true; /* ignore */ }
    // O vigia: o título/HUD só aparecem depois de a `conectar()` do jogo responder (jogo.js:39-40)
    // e o prazo conta desde o CARREGAMENTO. Cada passo é uma leitura de string barata; a decisão é
    // tomada UMA vez (`_pvDecidido`).
    every(5000, () => { try { primeiraVezPasso(); } catch { /* ignore */ } });
    // ... e uma tentativa imediata (o HUD pode já estar pronto quando a extensão injecta).
    setTimeout(() => { try { primeiraVezPasso(); } catch { /* ignore */ } }, 1000);
  }
  /** Estado da funcionalidade — para a GUI e para o diagnóstico (não muda nada). */
  function primeiraVezEstado() {
    const lido = lerNomeConta();
    return { decidido: _pvDecidido, marca: _pvUltimo, contas: _pvContas.slice(),
      primeiraDoScript: _pvPrimeiraScript, conta: lido.nome, fonte: lido.fonte,
      convidado: lido.fonte === 'sem-titulo' ? null : ehContaConvidado(lido.nome),
      mexeuNoMestre: _pvMexeu, esperaSeg: numOr(cfg.primeiraVezSeg, 180),
      autoLigarPrimeiraVez: cfg.autoLigarPrimeiraVez !== false, ligado: cfg.enabled === true };
  }

  function loadConfig() {
    const ler = (s) => { if (!s) return; cfg = { ...DEFAULT, ...((migrarCfg(s) || {}).cfg || {}), enabled: !!(s.enabled ?? s.automation?.enabled) }; };
    try {
      chrome.storage.local.get(STORAGE_KEY, (r) => { const s0 = r?.[STORAGE_KEY]; ler(s0); try { const cur = s0 || {}; chrome.storage.local.set({ [STORAGE_KEY]: { ...cur, cfgVer: CFG_VER, automation: { ...(cur.automation || {}), ...cfg } } }); } catch { /* ignore */ } });   // C3: o cfgVer grava-se no ARRANQUE
      chrome.storage.onChanged.addListener((ch, area) => {
        if (area !== 'local' || !ch[STORAGE_KEY]?.newValue) return;
        const nv = ch[STORAGE_KEY].newValue;
        // O DONO MEXEU NO MESTRE POR FORA DO MOTOR (ex.: o popup grava `enabled` directo no
        // storage, popup.js:158)? Então a "primeira vez" NÃO pode voltar a ligá-lo sozinho: o
        // pedido explícito do dono manda mais que o prazo dos 3 minutos.
        if (!_pvAuto && typeof nv.enabled === 'boolean' && nv.enabled !== cfg.enabled) _pvMexeu = true;
        ler(nv);
      });
    } catch { /* ignore */ }
  }

  // expõe helpers de leitura para o gui.js (mesmo mundo isolado)
  /** Aplica ajustes no cfg em runtime E persiste (mesmo formato que o loader lê). */
  function setConfig(patch) {
    if (patch && typeof patch === 'object') {
      // A GUI passa por AQUI para ligar/desligar o interruptor-mestre. Se o dono mexer nele antes
      // do prazo da "primeira vez", o prazo NÃO o volta a ligar sozinho (a decisão dele manda).
      if (!_pvAuto && Object.prototype.hasOwnProperty.call(patch, 'enabled')) _pvMexeu = true;
      Object.assign(cfg, patch);
    }
    try {
      chrome.storage.local.get(STORAGE_KEY, (r) => {
        const cur = (r && r[STORAGE_KEY]) || {};
        chrome.storage.local.set({ [STORAGE_KEY]: { ...cur, enabled: cfg.enabled, automation: { ...(cur.automation || {}), ...cfg } } });
      });
    } catch { /* ignore */ }
    return cfg;
  }

  window.__lolidleAuto = { rankItensSobrevivencia, sobrevivenciaSet, nivelDoChefe, nivelDifMotor, classeItem, fatorDanoJogadorMotor, CFG_VER, MIGRACOES_CFG, fatorDanoMonstroMotor, difNivelMotor, farmarItemPasso, recomendarAtributos, folhasDeReceitaFaltando, clicarIgnorarBasicos, mediaWaveDe, NIVEL_DIF_FB, farmarItemEstado, farmarItemParar, farmarItemTenho, larvasInvoca, checarChefeFatal, eventosContadores, eventosVivos, estadoVivo, consumirEvento, statsDePeca, pecaConhecida, escolherConjunto, porMelhorBase, nivelMobDe, farmarItem, migrarCfg, localId, nivelAlvo, press, readGold, readLocation, readPotions, scanBag, planBag, planPotions, readMap, readSkills, readEquip, readStats, player, dpsPorHabilidade, trocarSkills, skillsDisponiveis, rotacaoSkills, ehUltimate, areaDificil, ritmoMobs, valeUlt, estimarSet, previaSet, decidirPocao, estimarLuta, estado, infoItem, cdrEquipado, efeitosEquipados, parseDica, analisarLutaBoss, statsMonstro, avaliar, agregar, recomendar, rankItens, planejar, analisarWaves, analisarRun, getRunLog, estimarRegiao, meuDps, calibrar, ehNoite, clickNPC, andarParaCima, subirNaFonte, clicarNpcDoCofre, curarBase, venderBase, reporPocoes, acaoBase, regiaoIdeal, rankRegioes, supervisarBase, diagnosticoBase, tickAutoplay, saudeAutoplay, pausar, pausarPor, despausar, estaPausado, podeAgir, desligarTudo, religarTudo, limparEstadoAtivo, snapshotEstado, lerMinhasOfertas, cancelarOferta, anunciarItem, fecharMercado, lerCofre, lerCofreSlots, abrirCofreTesoureira, salvarCofre, melhorDoCofre, retirarDoCofre, obterItem, parseSlotId, melhorSlot, lerMercado, lerOfertas, planejarMercado, anunciarItemPorBase, executarMercado, melhorSet, scoreSet, dpsItens, dpsCenarios, previsorHistorico, preverBuild, rankBuildsTestadas, rankNormalizado, checarItens, guardarNoCofre, aceitarTarefa, entregarTarefa, aceitarDiarias, tarefaEstado, distribuirAtributos, equiparMelhores, setConfig, anunciarLendarios, mercadoSaturado, parseNum, refinarMelhores, receitasOrnn, montarItem, componentesDaBuild, montarMelhorReceita, pularTutorial, subirHabilidades, pegarPresentes, poderItem, valorDe, sinergiaDe, valorPassiva, perfilCampeao, identidadeCampeao, classeCampeao, alvoEquip, planoEquipar, cmpEquip, ehUsavelPeloCampeao, rarDe, mapaEspecial, especialDe, ehEspecialMeu, ehEspecialErrado, ITENS_ESPECIAIS, barraIdeal, lerBarra, aplicarBarra, skillsPorFase: () => cfg.skillsPorFase !== false,
    podeFazer, arvoreInterruptores, INTERRUPTORES, regiaoAntesDaBase, regiaoSegura, rmMonstro, armMagicaEfetiva, valorEquip, valorVenda, nomeCompleto, ehCampeaoAlvo, cofreInfo, valorDoPonto, dpsRank, valorBuff, ctxDano, modeloAtribDe, necessidadesBase, faltandoNaBase, passoFalhou, PASSOS_BASE, precisaRefino, scoreRegiao, taxaXpOuro, abaixoDoNivel, objDe, minimoPocoes, minimoPocoesAgora, pocaoCompravel, estaIndisponivel, marcarIndisponivel, FARM_FORCADO_MS, custoIdaBase, NECESSIDADES_PRIMARIAS, buildDaClasse, lendariosDaClasse, ehLendarioDaBuild, buildIdeal, buildIdealPara, planoTodos, perfilDe, basicosDaBuild, comprarNoMercado, lerOfertasCompra, snapshotJogo, simularCaminho, substitutos, melhorCompra, salvarOfertas, ofertasEmCache, iniciarTeste, pararTeste, testeAtivo, testeEstado, passoTeste, equiparItem, desequiparItem, aplicarItens, iniciarGiro, pararGiro, giroAtivo, ondeItem, localId, viajarPara, exportar, importar,
    // ---- O HUD DO JOGO COMO FONTE (frente OBSERVABILIDADE, 2026-10-14) ----
    // Leitores dos numeros que O PROPRIO JOGO escreve no DOM e as mecanicas que passaram a ser
    // modeladas com eles: vida com k/M e escudo, recarga exacta, efeitos activos, recarga de item,
    // o medidor do jogo (xp/h, ouro/h, abates/h, DPS, loot), nivel do chefe pela regra do motor,
    // Voracidade por abate com os abates/min medidos ao vivo, roubo de vida e critico.
    numEcra, parseBig, lerVidaHud, lerStatsId, lerBuffs, lerRecargaItens, lerAnaliseJogo, divergenciasPocao, divergenciasKit, fracAuto, pocaoInfo,
    killsMinAoVivo, voracidadeDe, cdVoraz, nivelChefeDe, mecanicaDe, fracHabs, multCrit, critDoSet, tierDe, capsMotor: () => ({ cdr: CAP_CDR, penMag: CAP_PEN_MAG, esquiva: CAP_ESQUIVA, critico: CAP_CRITICO, velAtaque: VEL_ATAQUE_MAX, penArmadura: penArmaduraDe(0.45, true) }),
    // ---- PENETRACAO DO KIT (TK-02-114): a pen de armadura que vem do KIT do campeao, por rank,
    // lida do kit do motor (motor.js:529 -> 552). So o E do Darius a tem.
    penKitDe, penKitCampeao, rankKitDe, statsSet, aplicarKit,
    // ---- CURA DO GIRO (TK-02-130): a cura propria da Katarina, por rank da D ---
    curaGiroDe, curaGiroS, cdVorazMotor, _larvasInvoca: () => _larvasInvoca.slice(),
    // ---- PROVA DAS GUARDAS DE RE-ENTRANCIA (2026-10-18): o ciclo
    //   agregar -> curaGiroS -> dpsPorHabilidade -> cdVoraz -> killsMinAoVivo -> ritmoMobs -> agregar
    // so' e' cortado por estas guardas. Sem elas a pagina CONGELA. O banco le estes contadores
    // para provar que a guarda existe E que o caminho a usa (mutation: retirar a guarda -> 0).
    agregarReentradas: () => _agregarReentradas,
    ritmoReentradas: () => _ritmoReentradas,
    // ---- HEMORRAGIA DO DARIUS (TK-02-149) ----
    bonusPoderDe, danoSangueDe, hemorragiaDe, bonusAdDe, adBaseCampeao,
    // ---- BUILD POR FASE (mob × chefe) e AS QUATRO FONTES ----
    buildParaMob, buildParaChefe, buildDaFase, buildIdealParaFase, faseBuild, planoBuildFase,
    alvoQuatroFontes, fontesDeItens, minhasOfertas, cofreConhecido, pecasDaFaseNoCofre,
    basesReservadas, ehReservado, fasesDoItem, trocarBuildDaFase, buscarPecasDaFase, lerCofreBase,
    valorDeFase, cmpEquipFase, pesosItemFase, bonusItemFase, motivoFase, NOME_FASE, PESO_FASE, alvoDeReferencia, valorPctVida, PASSIVA_POR_ALVO,
    // PRIMEIRA VEZ DO SCRIPT/CONTA: estado (só leitura) e o passo da decisão — a GUI pode mostrar
    // PORQUE é que o auto-play se ligou sozinho; o banco pode forçar a avaliação sem esperar 3 min.
    primeiraVez: primeiraVezEstado, primeiraVezPasso,
    auditoriaPassivas,
    PRIORIDADE_EXTREMA, ehPrioridadeExtrema,
    getMeta: () => META, getFarm: () => farm, getConfig: () => cfg,
    // ---- WATCH-LIST DO MERCADO (2026-10-18): deteccao em tempo real + auto-compra ----
    casarOfertas, itemNaWatch, baseDoItemMercado, lerMercadoServidor, reservaOuroWatch,
    podeComprarOfertaWatch, acharCardWatch, comprarOfertaWatch, ofertasWatchDoDom,
    vigiarMercadoPasso, mercadoWatchEstado };

  // AUTO-LIMPEZA: se o script JÁ rodou (reinjeção), cancela os timers antigos.
  // Sem isso cada injeção empilha outro conjunto de loops e TRAVA o jogo.
  const _T = (window.__lolidleAutoTimers = window.__lolidleAutoTimers || []);
  for (const t of _T) { try { clearInterval(t); clearTimeout(t); } catch { /* ignore */ } }
  _T.length = 0;
  // ATENCAO (bug PROVADO ao vivo, 2026-10-18): este helper estava a ser chamado com os argumentos
  // TROCADOS. A definicao era `(ms, fn)` mas o bloco de arranque chama `every(fn, ms)` — logo
  // `setInterval(3000, loop)`: o PRIMEIRO argumento e um NUMERO. O browser converte-o em string e
  // tenta AVALIA-LO como JavaScript; o mundo isolado da extensao tem CSP sem 'unsafe-eval' -> o
  // erro que o dono viu na consola ("Evaluating a string as JavaScript violates ... 'unsafe-eval'
  // is not an allowed source ... The action has been blocked") e — pior — a callback REAL nunca
  // corria: TODOS os loops do arranque (loop/accumulate/checarRotacao/supervisarBase/checarPocoes/
  // checarItens/mercado) estavam MORTOS. Aceita agora as duas ordens, para nao voltar a partir.
  const every = (a, b) => { const fn = typeof a === 'function' ? a : b; const ms = typeof a === 'function' ? b : a; const id = setInterval(fn, ms); _T.push(id); return id; };
  if (window.__lolidleAutoObs) { try { window.__lolidleAutoObs.disconnect(); } catch { /* ignore */ } }

  loadConfig();
  primeiraVezIniciar();       // PRIMEIRA VEZ: liga o auto-play sozinho 3 min após o carregamento (uma única vez)
  every(loop, 3000);
  every(() => { if (teste && !pausado) passoTeste().catch(() => { /* ignore */ }); }, 1000);   // mob exato (1 s)
  every(accumulate, 1000);
  every(checarRotacao, 2000);
  every(() => { checarFiltroBasicos().catch(() => { /* ignore */ }); }, 30000);
  every(supervisarBase, 5000);
  // WATCH-LIST DO MERCADO (pedido do dono, 2026-10-18): POLLER EM TEMPO REAL. A cadencia e do
  // dono (cfg.mercadoWatch.cadenciaMs); o tique e curto e so le o servidor quando passa a
  // cadencia. A deteccao corre em qualquer sitio; a COMPRA so age no Mercador (naBase()) e
  // com o interruptor vigiarMercado ligado (podeFazer, dentro de comprarOfertaWatch).
  every(() => {
    try {
      if (cfg.autoVigiarMercado === false) return;
      const w = cfg.mercadoWatch || {};
      if (!((w.itens || []).length || (w.vendedores || []).length)) return;
      const ms = Math.max(1500, Number(w.cadenciaMs) || 5000);
      if (Date.now() - _watchTentou < ms) return;
      vigiarMercadoPasso().catch(() => { /* ignore */ });
    } catch { /* ignore */ }
  }, 1500);
  every(checarPocoes, 5000);
  every(() => { checarItens().catch(() => { /* ignore */ }); }, 5000);
  cuidarNovidades();
  loop();
  carregarMeta();
  every(() => { try { chrome.storage.local.set({ [AGG_KEY]: agregar() }); } catch { /* ignore */ } }, 15000);
  // observa o #log da aba Servidor (loot/chefe)
  const logEl = document.querySelector('#log');
  if (logEl) { window.__lolidleAutoObs = new MutationObserver(scanLog); window.__lolidleAutoObs.observe(logEl, { childList: true }); }   // sem subtree (o #log muda muito)
  scanLog();
  chrome.storage.local.get(FARM_KEY, (r) => {
    const g = r && r[FARM_KEY];
    if (g) {
      // Descarta ciclos vazios vindos do storage (poluição histórica): sem ouro,
      // sem xp, sem abates e sem chefe não dizem NADA sobre a build e estragam
      // o previsor empírico. Ver o mesmo filtro no handleLog.
      farm.cycles = (g.cycles || []).filter((c) => (c.gold || 0) > 0 || (c.xp || 0) > 0 || (c.mobFase && c.mobFase.kills > 0) || !!c.boss);
      farm.log = g.log || [];
      farm.lutas = g.lutas || [];
      farm.deaths = (g.deaths || []).filter((d) => /morto/i.test(d.body || ''));   // limpa mortes FALSAS (NPC/item)
      farm.issues = (g.issues || []).filter((x) => !/unsafe-eval|Content Security Policy/i.test(x.erro || ''));
    }
    farm.current = null;
  });
  // AUTO-RETOMAR o teste de builds (ver iniciarTeste): sem isto ele parava em silêncio a
  // cada reload e o M1 deixava de acumular. Só retoma se for recente (<2 h) e se não houver
  // já um teste a correr. Uma paragem EXPLÍCITA apaga a chave e portanto não retoma.
  try {
    chrome.storage.local.get(TESTE_KEY + ':ativo', (r) => {
      const t = r && r[TESTE_KEY + ':ativo'];
      if (!t || !t.sets || !t.sets.length) return;
      if (Date.now() - (t.at || 0) > 2 * 3600 * 1000) return;
      if (teste) return;
      const res = iniciarTeste(t.sets, { regiao: t.regiao, mobSeg: t.mobSeg, hpMin: t.hpMin });
      logEvent('teste', { retomado: true, ok: !!(res && res.ok), motivo: (res && res.motivo) || null, sets: t.sets.length });
    });
  } catch { /* ignore */ }
})();
