// Règles métier pures (sans interface) : fiches, statuts de garde, accords locaux, CSV.
import { norm, num, price, uid } from './util.js';

export const COLORS = ['Rouge', 'Blanc', 'Rosé', 'Pétillant', 'Autre'];
export const SCHEMA_VERSION = 3;

export function normColor(v) {
  const s = norm(v);
  if (!s) return 'Autre';
  if (/rou/.test(s)) return 'Rouge';
  if (/blanc/.test(s)) return 'Blanc';
  if (/ros/.test(s)) return 'Rosé';
  if (/champ|cremant|mouss|petil|brut|bulle/.test(s)) return 'Pétillant';
  return 'Autre';
}

const str = v => (v === null || v === undefined ? '' : String(v).trim());

function toList(v) {
  if (Array.isArray(v)) return v.map(str).filter(Boolean);
  if (typeof v === 'string') return v.split(/[,;\n]/).map(s => s.trim()).filter(Boolean);
  return [];
}

// Transforme n'importe quelle entrée (ancienne version, sauvegarde, import, IA) en fiche propre.
// Renvoie null si la fiche n'a ni nom ni domaine.
export function normalizeWine(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const name = str(raw.name) || str(raw.dom);
  if (!name) return null;
  const q = num(raw.qty);
  const now = Date.now();
  return {
    id: str(raw.id) || uid(),
    name,
    dom: str(raw.dom),
    year: num(raw.year),
    color: COLORS.includes(raw.color) ? raw.color : normColor(raw.color),
    region: str(raw.region),
    grape: str(raw.grape),
    qty: q === '' ? 1 : Math.max(0, q),
    price: price(raw.price),
    loc: str(raw.loc),
    from: num(raw.from),
    to: num(raw.to),
    story: str(raw.story),
    pairings: toList(raw.pairings),
    note: str(raw.note),
    check: raw.check === true,
    // v3 : « connue » (auto-déclaré par le modèle, non vérifié) devient « estimée » ; « vérifiée » exige des sources web.
    conf: raw.conf === 'vérifiée' ? 'vérifiée' : raw.conf === 'connue' || raw.conf === 'estimée' ? 'estimée' : '',
    sources: toSources(raw.sources),
    created: Number(raw.created) || now,
    updated: Number(raw.updated) || now,
  };
}

// Clé de doublon : même cuvée, même domaine, même millésime.
function toSources(v) {
  if (!Array.isArray(v)) return [];
  return v.filter(x => x && typeof x.u === 'string' && /^https:\/\//i.test(x.u)).slice(0, 5).map(x => ({ t: str(x.t).slice(0, 80) || 'Source', u: x.u }));
}

export const keyOf = w => norm([w.name, w.dom, w.year].join('|'));

export function status(w, year) {
  if (!w.from && !w.to) return null;
  if (w.from && year < w.from) return { label: 'À garder', cls: 'wa', code: 'keep' };
  if (w.to && year > w.to) return { label: 'Passé, à boire vite', cls: 'bad', code: 'late' };
  if (w.to && w.to <= year + 1) return { label: 'À boire vite', cls: 'wa', code: 'soon' };
  return { label: 'À boire', cls: 'ok', code: 'ready' };
}

export const urgent = (w, year) => w.qty > 0 && !!w.to && w.to <= year + 1;
export const drinkableNow = (w, year) => w.qty > 0 && !!(w.from || w.to) && (!w.from || w.from <= year) && (!w.to || w.to >= year);

export function stats(wines, year) {
  let bottles = 0, value = 0, soon = 0;
  for (const w of wines) {
    bottles += w.qty;
    value += w.qty * (w.price || 0);
    if (urgent(w, year)) soon += w.qty;
  }
  return { bottles, value, soon };
}

export function sortWines(list, key, year) {
  const a = list.slice();
  const byName = (x, y) => (x.name || '').localeCompare(y.name || '', 'fr') || (x.year || 0) - (y.year || 0);
  const stock = (x, y) => (y.qty > 0) - (x.qty > 0); // les vins épuisés passent en fin de liste
  if (key === 'urgent') a.sort((x, y) => stock(x, y) || (x.to || 9999) - (y.to || 9999) || byName(x, y));
  else if (key === 'year') a.sort((x, y) => stock(x, y) || (y.year || 0) - (x.year || 0) || byName(x, y));
  else if (key === 'recent') a.sort((x, y) => y.created - x.created);
  else a.sort((x, y) => stock(x, y) || byName(x, y));
  return a;
}

// Chaque mot tapé doit être le début d'un mot de la fiche (« mor » trouve Morgon, « 12 » ne trouve pas 2012).
export function matchesQuery(w, q) {
  const qs = norm(q).split(/[^a-z0-9]+/).filter(Boolean);
  if (!qs.length) return true;
  const words = norm([w.name, w.dom, w.region, w.loc, w.year, w.grape, w.color].join(' ')).split(/[^a-z0-9]+/).filter(Boolean);
  return qs.every(t => words.some(x => x.startsWith(t)));
}

/* ---------- Accords mets-vins sans IA ---------- */
const STOP = new Set('de du des la le les un une au aux en et a avec sur sous pour d l sauce facon maison petit petits petite petites grand dans ou the and plat repas diner dejeuner soir personnes'.split(' '));
const HINTS = [
  { re: /poisson|saumon|huitre|crevette|homard|langouste|moule|coquille|sole|bar |cabillaud|daurade|dorade|saint jacques|sushi|ceviche|fruits de mer|crustace|truite|lotte|bouillabaisse/, boost: { Blanc: 3, 'Pétillant': 2, 'Rosé': 1 }, why: 'blanc ou bulles avec la mer' },
  { re: /boeuf|bœuf|agneau|canard|magret|gibier|chevreuil|sanglier|entrecote|cote de|steak|daube|bourguignon|civet|onglet|bavette|grillade|barbecue|gigot/, boost: { Rouge: 3 }, why: 'rouge avec la viande' },
  { re: /poulet|volaille|dinde|pintade|chapon|veau|porc|lapin/, boost: { Rouge: 1, Blanc: 1 }, why: 'rouge léger ou blanc avec la volaille' },
  { re: /fromage|comte|chevre|brie|camembert|roquefort|reblochon|raclette|fondue|tartiflette/, boost: { Blanc: 1, Rouge: 1 }, why: 'blanc ou rouge avec le fromage' },
  { re: /dessert|gateau|tarte|chocolat|fruit|patisserie|anniversaire|galette/, boost: { 'Pétillant': 2 }, why: 'bulles au dessert' },
  { re: /apero|aperitif|amuse|tapas|fete|celebration/, boost: { 'Pétillant': 3, Blanc: 1, 'Rosé': 1 }, why: 'bulles ou blanc à l’apéritif' },
  { re: /salade|ete|barbecue|grill|asiat|thai|curry|epice/, boost: { 'Rosé': 2, Blanc: 1 }, why: 'rosé ou blanc frais' },
];

function tokens(text) {
  const out = new Set();
  for (let t of norm(text).split(/[^a-z0-9]+/)) {
    if (t.length < 3 || STOP.has(t)) continue;
    if (t.length > 4) t = t.replace(/(s|x)$/, '');
    out.add(t);
  }
  return [...out];
}

// Classe les vins en stock pour un plat, sans IA : accords enregistrés, couleur, moment de garde.
export function localPairing(dish, wines, year, limit = 5) {
  const toks = tokens(dish);
  const d = ' ' + norm(dish) + ' ';
  const hints = HINTS.filter(h => h.re.test(d));
  const res = [];
  for (const w of wines) {
    if (w.qty <= 0) continue;
    const st = status(w, year);
    if (st && st.code === 'keep') continue; // trop jeune
    const pairText = norm(w.pairings.join(' | '));
    const matched = w.pairings.filter(p => { const n = norm(p); return toks.some(t => n.includes(t)); });
    let score = matched.length * 3 + (toks.some(t => pairText.includes(t)) && !matched.length ? 1 : 0);
    let hintWhy = '';
    for (const h of hints) { const b = h.boost[w.color] || 0; if (b) { score += b; hintWhy = hintWhy || h.why; } }
    if (score <= 0) continue;
    if (st && (st.code === 'soon' || st.code === 'late')) score += 1.5;
    else if (st && st.code === 'ready') score += 1;
    const why = [
      matched.length ? 'Accord enregistré : ' + matched.slice(0, 2).join(', ') : '',
      !matched.length && hintWhy ? 'Couleur adaptée (' + hintWhy + ')' : '',
      st ? st.label.toLowerCase() : '',
    ].filter(Boolean).join(' · ');
    res.push({ w, score, why });
  }
  res.sort((a, b) => b.score - a.score || (a.w.to || 9999) - (b.w.to || 9999));
  return res.slice(0, limit);
}

/* ---------- CSV ---------- */
export const CSV_COLS = [
  ['name', 'Cuvée'], ['dom', 'Domaine'], ['year', 'Millésime'], ['color', 'Couleur'], ['region', 'Appellation'],
  ['grape', 'Cépage'], ['qty', 'Quantité'], ['price', 'Prix'], ['loc', 'Emplacement'], ['from', 'Début garde'],
  ['to', 'Fin garde'], ['story', 'Histoire'], ['pairings', 'Accords'], ['note', 'Notes'],
];

export function toCsv(wines) {
  const q = v => '"' + String(v ?? '').replace(/"/g, '""') + '"';
  const head = CSV_COLS.map(c => q(c[1])).join(';');
  const rows = wines.map(w => CSV_COLS.map(([k]) => q(k === 'pairings' ? w.pairings.join(', ') : k === 'price' && w.price !== '' ? String(w.price).replace('.', ',') : w[k])).join(';'));
  return '﻿' + [head, ...rows].join('\r\n');
}

/* ---------- Sauvegardes ---------- */
export function makeBackup(wines) {
  return JSON.stringify({ app: 'cave-a-vin', schema: SCHEMA_VERSION, date: new Date().toISOString(), count: wines.length, wines }, null, 1);
}

// Accepte les sauvegardes v1 (prototype), v2, ou un tableau brut. Renvoie { wines, skipped } ou lève une erreur lisible.
export function parseBackup(text) {
  let d;
  try { d = JSON.parse(String(text).replace(/^﻿/, '')); } catch (e) { throw new Error('Ce fichier n’est pas une sauvegarde de cave (JSON illisible).'); }
  const list = Array.isArray(d) ? d : d && Array.isArray(d.wines) ? d.wines : null;
  if (!list) throw new Error('Ce fichier ne contient pas de liste de vins.');
  const seen = new Set(); const wines = []; let skipped = 0;
  for (const raw of list) {
    const w = normalizeWine(raw);
    if (!w) { skipped++; continue; }
    if (seen.has(w.id)) w.id = uid();
    seen.add(w.id); wines.push(w);
  }
  return { wines, skipped };
}
