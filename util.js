// Petites fonctions utilitaires partagées.
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Minuscules, sans accents, espaces compactés : pour comparer et chercher.
export const norm = s => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();

// Entier ou '' (vide) si non numérique.
export const num = v => {
  if (v === null || v === undefined || v === '') return '';
  const n = parseInt(String(v).trim(), 10);
  return Number.isNaN(n) ? '' : n;
};

// Prix : accepte « 12,50 € », « 12.5 », 12.5 ; '' si absent.
export const price = v => {
  if (v === null || v === undefined || v === '') return '';
  if (typeof v === 'number') return Number.isFinite(v) && v >= 0 ? v : '';
  const s = String(v).replace(/[^\d,.-]/g, '').replace(',', '.');
  const n = parseFloat(s);
  return Number.isFinite(n) && n >= 0 ? n : '';
};

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

export const sleep = (ms, signal) => new Promise((resolve, reject) => {
  const t = setTimeout(resolve, ms);
  if (signal) signal.addEventListener('abort', () => { clearTimeout(t); reject(Object.assign(new Error('abort'), { name: 'AbortError' })); }, { once: true });
});

// « 21 pourcent » (ou « pour cent ») devient « 21 % » : l'IA écrit parfois le mot en toutes lettres.
export const symPct = t => String(t == null ? '' : t).replace(/(\d+(?:[.,]\d+)?)\s*(?:pour\s?cents?|pourcents?)(?![a-zà-ÿ])/gi, '$1 %');
