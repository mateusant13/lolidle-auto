// Ganhar dinheiro de verdade (out/2026): a indicação. Usado pelo jogo, pelo site e pelo servidor.
// Quem trouxe o jogador ganha uma parte do que ele gastar em diamantes (o dinheiro já entrou pelo Mercado Pago ou pelo
// Stripe), liberada depois do prazo de estorno. Os saques são por PIX e pagos à mão (ver _raw/saques.mjs).
// (A temporada com prêmio em dinheiro foi feita e retirada no mesmo dia: o dono não tinha pedido. O banco ainda tem as
// tabelas temporada e temporadas_fechadas, sem uso.)
export const GANHOS = {
  comissao: 0.2,                // parte de cada compra de diamantes do indicado
  esperaComissao: 30,           // dias até a comissão poder ser sacada (o prazo de estorno do cartão)
  saqueMin: 20,                 // saque mínimo (R$)
  cotacaoUsd: 5.5,              // compra em dólar (cartão em inglês) vira reais por esta cotação
  // sorteio (out/2026): a cada 10 pessoas que chegam pelo link de alguém, uma delas ganha VIP. Só conta quem confirmou o
  // email e chegou ao nível mínimo (senão bastaria criar contas falsas pelo próprio link)
  sorteio: { aCada: 10, diasVip: 30, nivelMin: 5 },
};
const BR = 3 * 3600000;         // Brasília = UTC−3
// o mês da temporada ("2026-10") no horário de Brasília
export const mesDe = (ms = Date.now()) => new Date(ms - BR).toISOString().slice(0, 7);
// quando o mês começa e termina (ms), no horário de Brasília
export const inicioDoMes = (mes) => { const [a, m] = mes.split('-').map(Number); return Date.UTC(a, m - 1, 1) + BR; };
export const fimDoMes = (mes) => { const [a, m] = mes.split('-').map(Number); return Date.UTC(a, m, 1) + BR; };
export const mesAnterior = (mes) => mesDe(inicioDoMes(mes) - 1);
// valor em reais para mostrar ("R$ 12,50")
export const reais = (v, en = false) => 'R$ ' + (Math.round(v * 100) / 100).toLocaleString(en ? 'en-US' : 'pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
// o código de indicação vem no endereço (?ref=Nome) e fica guardado no navegador até a conta ser criada
export function guardarIndicacao() {
  try {
    const ref = new URLSearchParams(location.search).get('ref');
    if (ref && /^[\p{L}\p{N}_]{3,20}$/u.test(ref)) localStorage.setItem('lolidle-ref', JSON.stringify({ ref, em: Date.now() }));
  } catch {}
}
export function indicacaoGuardada() {
  try { const r = JSON.parse(localStorage.getItem('lolidle-ref') || 'null'); return r && Date.now() - r.em < 30 * 86400000 ? r.ref : null; } catch { return null; }
}

