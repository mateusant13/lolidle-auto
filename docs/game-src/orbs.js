// Gema (out/2026, a mesma estratégia do Pokéidle): a moeda do mercado com lastro em USDT. Usado pelo jogo e pelo servidor.
// Por dentro se chama "orbs" (as gemas do Ornn continuam sendo e.gemas no save; na tela viraram Runas).
// - Só ENTRA por depósito de USDT na rede Solana (cripto não tem estorno) e só SAI em USDT, pelo saque.
// - Nunca é dada de graça: não cai de monstro, não sai de tarefa, não vem de compra com PIX ou cartão.
//   Toda Gema que existe foi depositada por alguém, então todo saque tem o dinheiro dele na carteira do projeto.
// - O jogo ganha na taxa das vendas em Gema no mercado (7,5% a 13%, ver taxaOrbs); comprar e sacar têm o mesmo preço.
export const ORBS = {
  compra: 0.01,                 // USDT por Gema ao depositar (10 USDT = 1.000 Gemas)
  saque: 0.01,                  // USDT por Gema ao sacar
  saqueMin: 1000,               // Gemas
  depositoMin: 1,               // USDT (abaixo disso o depósito fica parado esperando o dono olhar)
  // taxa das vendas em Gema no mercado, por faixa do preço (venda grande paga menos): até 1.000, até 10.000, acima
  faixasTaxa: [[1000, 0.13], [10000, 0.1], [Infinity, 0.075]],
  precoMax: 10_000_000,         // preço máximo de uma oferta em Gemas
  rede: 'Solana',
  token: 'USDT',
  mint: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',     // o USDT na rede Solana
};
// o código que o jogador escreve no "memo" da transferência: é por ele que o servidor sabe de quem é o depósito
// (letras e números sem os que confundem; o último é um dígito de conferência)
const LETRAS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function referenciaDe(conta) {
  let n = Number(conta) * 7919 + 104729, s = '';
  while (n > 0) { s = LETRAS[n % 32] + s; n = Math.floor(n / 32); }
  const soma = [...s].reduce((a, c) => a + LETRAS.indexOf(c), 0);
  return 'LI' + s + LETRAS[soma % 32];
}
export function contaDaReferencia(texto) {
  // lê palavra por palavra (o memo pode ter outras palavras em volta, ou o código repetido)
  for (const p of String(texto || '').toUpperCase().split(/[^A-Z0-9]+/)) {
    if (!/^LI[A-HJ-NP-Z2-9]{4,11}$/.test(p)) continue;
    const corpo = p.slice(2), s = corpo.slice(0, -1), dv = corpo.slice(-1);
    if (LETRAS[[...s].reduce((a, c) => a + LETRAS.indexOf(c), 0) % 32] !== dv) continue;
    const n = [...s].reduce((a, c) => a * 32 + LETRAS.indexOf(c), 0) - 104729;
    if (n > 0 && n % 7919 === 0) return n / 7919;
  }
  return null;
}
// endereço de carteira Solana: base58, 32 a 44 caracteres
export const enderecoValido = (s) => /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(String(s || '').trim());
// quantas Gemas um depósito compra, e quanto vale um saque em USDT
export const orbsDoDeposito = (usdt) => Math.floor((Number(usdt) || 0) / ORBS.compra + 1e-9);
export const usdtDoSaque = (orbs) => Math.floor((Number(orbs) || 0) * ORBS.saque * 100) / 100;
export const usd = (v) => '$' + (Math.round((Number(v) || 0) * 100) / 100).toFixed(2);
// a taxa de uma venda em Gemas e quanto o vendedor recebe
export const taxaOrbs = (preco) => ORBS.faixasTaxa.find(([ate]) => preco <= ate)[1];
export const vendedorRecebe = (preco) => Math.floor(preco * (1 - taxaOrbs(preco)));

