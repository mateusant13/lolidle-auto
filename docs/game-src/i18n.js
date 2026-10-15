// Idioma do jogo (português ou inglês). O texto em português é a própria chave da tradução:
//   t('Você viajou para {lugar}.', { lugar }) → em inglês procura essa frase no dicionário (js/i18n/en.js);
//   sem tradução, fica o português (nunca quebra). Os {nomes} entre chaves são trocados pelos valores.
// No navegador o idioma vem da escolha salva ou do navegador; no servidor é sempre português (use tEm).
import { EN } from './i18n/en.js';

const CHAVE = 'lolidle-idioma';
const noNavegador = typeof window !== 'undefined';
// o site tem endereço por idioma: /en é sempre inglês; na página inicial, robô de busca vê sempre português
const SITE_EN = /^\/en\/?$/, ROBO = /bot|crawl|spider|slurp|facebookexternalhit|embedly|preview/i;
function detectar() {
  if (SITE_EN.test(location.pathname)) return 'en';
  if (location.pathname === '/' && ROBO.test(navigator.userAgent)) return 'pt';
  try { const s = localStorage.getItem(CHAVE); if (s === 'pt' || s === 'en') return s; } catch {}
  return /^pt/i.test(navigator.language || 'pt') ? 'pt' : 'en';
}
export const idioma = noNavegador ? detectar() : 'pt';
export const ingles = idioma === 'en';
if (noNavegador) document.documentElement.lang = ingles ? 'en' : 'pt-BR';

const preencher = (s, v) => (v ? s.replace(/\{(\w+)\}/g, (m, k) => (k in v ? v[k] : m)) : s);
// traduz uma frase para o idioma atual
export const t = (pt, v) => preencher(ingles ? EN[pt] ?? pt : pt, v);
// traduz para um idioma escolhido (no servidor: o idioma de quem pediu)
export const tEm = (lang, pt, v) => preencher(lang === 'en' ? EN[pt] ?? pt : pt, v);
// o idioma de uma requisição (o jogo manda o cabeçalho X-Idioma)
export const idiomaDe = (req) => (String(req?.headers?.['x-idioma'] || '').toLowerCase() === 'en' ? 'en' : 'pt');

export function definirIdioma(l) {
  try { localStorage.setItem(CHAVE, l === 'en' ? 'en' : 'pt'); } catch {}
  // no site, cada idioma tem o seu endereço; no jogo, só recarrega
  if (location.pathname === '/' || SITE_EN.test(location.pathname)) location.href = (l === 'en' ? '/en' : '/') + location.hash;
  else location.reload();
}

// traduz o texto fixo do HTML: elementos com data-i18n="chave" trocam o HTML de dentro (para parágrafos com negrito,
// links…); os outros textos, title, placeholder, aria-label e alt são trocados quando estão no dicionário
const ATRIBUTOS = ['title', 'placeholder', 'aria-label', 'alt'];
export function traduzirDom(raiz = document.body) {
  if (!ingles || !raiz) return;
  for (const el of raiz.querySelectorAll('[data-i18n]')) { const k = el.dataset.i18n; if (k in EN) el.innerHTML = EN[k]; }
  const andar = document.createTreeWalker(raiz, NodeFilter.SHOW_TEXT);
  const textos = [];
  for (let n = andar.nextNode(); n; n = andar.nextNode()) textos.push(n);
  for (const n of textos) {
    const bruto = n.nodeValue, limpo = bruto.trim();
    if (!limpo || !(limpo in EN)) continue;
    n.nodeValue = bruto.replace(limpo, EN[limpo]);
  }
  for (const el of raiz.querySelectorAll('[title],[placeholder],[aria-label],[alt]')) {
    for (const a of ATRIBUTOS) { const v = el.getAttribute(a); if (v && v.trim() in EN) el.setAttribute(a, EN[v.trim()]); }
  }
}

// bandeirinhas desenhadas em SVG (bandeira em emoji não aparece no Windows)
const BANDEIRA = {
  pt: '<svg class="bandeira" viewBox="0 0 20 14" aria-hidden="true"><rect width="20" height="14" fill="#1f9a3a"/><path d="M10 1.6 18.2 7 10 12.4 1.8 7z" fill="#fedf00"/><circle cx="10" cy="7" r="3.3" fill="#1c3f94"/><path d="M6.9 6.4c2.1-.5 4.3-.2 6.2.9" stroke="#fff" stroke-width=".7" fill="none"/></svg>',
  en: '<svg class="bandeira" viewBox="0 0 20 14" aria-hidden="true"><rect width="20" height="14" fill="#fff"/><g fill="#b22234"><rect width="20" height="1.08"/><rect y="2.15" width="20" height="1.08"/><rect y="4.3" width="20" height="1.08"/><rect y="6.46" width="20" height="1.08"/><rect y="8.62" width="20" height="1.08"/><rect y="10.77" width="20" height="1.08"/><rect y="12.92" width="20" height="1.08"/></g><rect width="8.6" height="7.54" fill="#3c3b6e"/><g fill="#fff"><circle cx="1.4" cy="1.3" r=".42"/><circle cx="3.6" cy="1.3" r=".42"/><circle cx="5.8" cy="1.3" r=".42"/><circle cx="2.5" cy="2.8" r=".42"/><circle cx="4.7" cy="2.8" r=".42"/><circle cx="6.9" cy="2.8" r=".42"/><circle cx="1.4" cy="4.3" r=".42"/><circle cx="3.6" cy="4.3" r=".42"/><circle cx="5.8" cy="4.3" r=".42"/><circle cx="2.5" cy="5.8" r=".42"/><circle cx="4.7" cy="5.8" r=".42"/><circle cx="6.9" cy="5.8" r=".42"/></g></svg>',
};
// botões PT / EN com a bandeira (o atual fica marcado)
export function seletorIdioma(classe = 'seletor-idioma') {
  const b = (l, txt, nome) => `<button type="button" data-idioma="${l}" aria-pressed="${idioma === l}" title="${nome}">${BANDEIRA[l]}<span>${txt}</span></button>`;
  return `<span class="${classe}" role="group" aria-label="Idioma / Language">${b('pt', 'PT', 'Português')}${b('en', 'EN', 'English')}</span>`;
}
if (noNavegador) addEventListener('click', (e) => {
  const b = e.target.closest?.('[data-idioma]');
  if (b && b.dataset.idioma !== idioma) definirIdioma(b.dataset.idioma);
});
