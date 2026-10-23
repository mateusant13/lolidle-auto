/*
 * abandono.test.mjs - NAO SE ABANDONA UM CHEFE QUASE MORTO.
 *
 * QUEIXA DO DONO (2026-10-23 17:19), verbatim:
 *   "eu vi meu boneco quase matando o barao. chegou no final da vida dele, voltou pra base
 *    sozinho. que ridiculo. que matematica de merda que tu ta fazendo."
 *
 * CAUSA MEDIDA (log ao vivo, 17:19:55-17:20:10): o `supervisarBase` decidia o recall pela
 * NECESSIDADE (`base: mercado,comprar`) e por mais nada. O estado vivo tinha o chefe a lutar
 * (`inimigos[]` com `chefe:true` e hp > 0) e o `press('b')` saiu na mesma — o abate inteiro
 * foi deitado fora, porque o chefe volta cheio.
 *
 * A FONTE e o JOGO: `inimigos[].chefe` / `.guardiao` + `hp` (o mesmo campo que o `motor.js`
 * usa para o chefe da regiao). Nenhum numero inventado aqui.
 *
 * CONTRATO: t.check(rotulo, condicao) so passa com condicao === true.
 */

import { criarMundo, carregarAutomation, alimentarCatalogo } from './dom-stub.mjs';

/** Mundo minimo: so o estado vivo interessa para esta regra. */
function mundo() {
  const m = criarMundo();
  const auto = carregarAutomation(m);
  alimentarCatalogo(m);
  return { m, auto };
}

const estado = (inimigos) => ({ __lolidleAuto: 'estado', v: 1, at: Date.now(), local: 'barao', inimigos });

export const suite = {
  nome: 'abandono',
  titulo: 'Chefe/guardiao vivo no ecra: nao se recorda para a base (e o tecto de 3 min)',

  async run(t) {
    /* ============ A1-A5: O PREDICADO (lido do estado vivo do jogo) ============ */
    {
      const { m, auto } = mundo();
      t.check('A1: sem inimigos -> nao ha chefe vivo', auto.chefeVivo() === null);

      m.dispatchMessage(estado([{ nome: 'lobo', hp: 900 }]));
      t.check('A2: mob normal NUNCA paralisa o boneco (so chefe/guardiao seguram)',
        auto.chefeVivo() === null);

      m.dispatchMessage(estado([{ nome: 'Barao', chefe: true, hp: 5000 }]));
      const v = auto.chefeVivo();
      t.check('A3: chefe vivo -> segura o recall', !!v && v.n === 1 && v.segurando === true);

      m.dispatchMessage(estado([{ nome: 'Guardiao', guardiao: true, hp: 120 }]));
      const g = auto.chefeVivo();
      t.check('A4: guardiao vivo tambem segura (mesmo campo do motor)', !!g && g.n === 1 && g.segurando === true);

      m.dispatchMessage(estado([{ nome: 'Barao', chefe: true, hp: 0 }]));
      t.check('A5: chefe MORTO (hp 0) nao segura nada - o abate ja aconteceu',
        auto.chefeVivo() === null);
    }

    /* ============ A6-A8: A DECISAO (pode/nao pode recordar) ============ */
    {
      const { m, auto } = mundo();
      const t0 = 1_000_000_000;
      m.dispatchMessage(estado([{ nome: 'Barao', chefe: true, hp: 150 }]));

      const r1 = auto.podeRecordar(t0);
      t.check('A6: chefe a morrer -> NAO se recorda (pode:false) e o motivo diz porque',
        !!r1 && r1.pode === false && /chefe/i.test(String(r1.motivo || '')));

      // TECTO: um chefe que o boneco NAO consegue matar nao pode prende-lo para sempre.
      const r2 = auto.podeRecordar(t0 + 4 * 60 * 1000);
      t.check('A7: passados 4 min na MESMA luta deixa de segurar (pode:true)',
        !!r2 && r2.pode === true);

      // ...mas o relogio e' POR LUTA: outro chefe depois reinicia a contagem.
      m.dispatchMessage(estado([{ nome: 'Outro', chefe: true, hp: 3000 }]));
      const r3 = auto.podeRecordar(t0 + 4 * 60 * 1000);
      t.check('A8: chefe DIFERENTE reinicia o relogio (nao herda os 4 min do anterior)',
        !!r3 && r3.pode === false);
    }

    /* ============ A9: o ciclo real - morre o chefe, o recall segue ============ */
    {
      const { m, auto } = mundo();
      m.dispatchMessage(estado([{ nome: 'Barao', chefe: true, hp: 40 }]));
      t.check('A9a: a luta esta a decorrer', auto.podeRecordar().pode === false);
      m.dispatchMessage(estado([]));
      t.check('A9b: abate feito -> o recall fica livre no tick seguinte',
        auto.podeRecordar().pode === true);
    }
  },
};
