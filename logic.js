// Règles métier pures (sans interface) : fiches, statuts de garde, accords locaux, CSV.
import { norm, num, price, uid } from './util.js';

export const COLORS = ['Rouge', 'Blanc', 'Rosé', 'Pétillant', 'Autre'];
export const SCHEMA_VERSION = 10;

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
// Quantité écrite dans le nom (« 2 bouteilles de blanc… », « 3 x Syrah ») : on la sort du nom.
// Elle devient la quantité si la colonne quantité est vide, égale à 1, ou égale à ce nombre.
const QTY_PREFIX = /^\s*(\d{1,3})\s*(?:x|×|bouteilles?|btl|bt|flacons?)\s*(?:de\s+|d['’]\s*)?/i;
export function splitQty(name, qty) {
  const m = QTY_PREFIX.exec(String(name || ''));
  if (!m) return { name, qty };
  const n = parseInt(m[1], 10);
  const rest = String(name).slice(m[0].length).trim();
  if (!rest || n < 1) return { name, qty };
  return { name: rest, qty: (qty === '' || qty === 1 || qty === n) ? n : qty };
}
export function normalizeWine(raw) {
  if (!raw || typeof raw !== 'object') return null;
  let name = str(raw.name) || str(raw.dom);
  if (!name) return null;
  const q0 = num(raw.qty);
  const sq = str(raw.name) ? splitQty(name, q0 === '' ? 1 : q0) : { name, qty: q0 };
  name = sq.name;
  let q = sq.qty;
  let dom = str(raw.dom);
  // Ancien import : la colonne « Nombre de bouteilles » avait été lue comme nom (« 0 », « 1 »). Le nombre redevient la quantité, le domaine le nom.
  if (/^\d{1,3}$/.test(name) && dom) {
    if (q === 1 || q === '') q = parseInt(name, 10);
    name = dom; dom = '';
  }
  const now = Date.now();
  return {
    id: str(raw.id) || uid(),
    name,
    dom,
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
    // v4 : d'où vient la période de garde (user | ai | bible) ; sert à laisser l'IA corriger la bible.
    src: origins(raw.src),
    conf: raw.conf === 'vérifiée' ? 'vérifiée' : raw.conf === 'connue' || raw.conf === 'estimée' ? 'estimée' : '',
    sources: toSources(raw.sources),
    tastings: toTastings(raw.tastings),
    // Valeur indicative d'une bouteille (fourchette IA, sans recherche) : null si pas encore estimée.
    estim: toEstim(raw.estim),
    // Date de la passe IA faite sur ce vin (0 = jamais). Une seule passe, après l'enregistrement.
    aiPass: Number(raw.aiPass) || 0,
    // Date de la recherche web (0 = jamais) et champs encore à chercher.
    aiSearch: Number(raw.aiSearch) || 0,
    aiDoute: Array.isArray(raw.aiDoute) ? toDoute(raw.aiDoute) : undefined, // ancienne fiche : calculé à la demande
    created: Number(raw.created) || now,
    updated: Number(raw.updated) || now,
  };
}

// Journal de dégustation : { d: 'AAAA-MM-JJ', n: note de 1 à 5 étoiles, c: commentaire }.
function toEstim(v) {
  const min = Number(v && v.min), max = Number(v && v.max);
  if (!v || !(min > 0)) return null;
  return { min, max: max >= min ? max : min, date: Number(v.date) || 0 };
}

function toTastings(v) {
  if (!Array.isArray(v)) return [];
  return v.filter(x => x && /^\d{4}-\d{2}-\d{2}$/.test(String(x.d)) && Number.isInteger(Number(x.n)) && Number(x.n) >= 1 && Number(x.n) <= 5)
    .slice(0, 100).map(x => ({ d: String(x.d), n: Number(x.n), c: str(x.c).slice(0, 500) }));
}
// Nombre de dégustations notées et moyenne sur 5 (null s'il n'y en a pas).
export function degustations(w) {
  const t = Array.isArray(w.tastings) ? w.tastings : [];
  if (!t.length) return null;
  return { count: t.length, avg: Math.round(t.reduce((a, x) => a + x.n, 0) / t.length * 10) / 10 };
}

// Clé de doublon : même cuvée, même domaine, même millésime.
function toSources(v) {
  if (!Array.isArray(v)) return [];
  return v.filter(x => x && typeof x.u === 'string' && /^https:\/\//i.test(x.u)).slice(0, 5).map(x => ({ t: str(x.t).slice(0, 80) || 'Source', u: x.u }));
}

const ORIGINS = ['user', 'ai', 'bible'];
// Champs que l'IA peut compléter ou corriger. Chacun porte son origine (src) : user (saisi à la main) | ai | bible.
export const AI_FIELDS = ['grape', 'story', 'pairings', 'from', 'to'];
// Champs que la recherche web peut compléter (la garde compte pour « from »).
export const DOUTE = ['grape', 'story', 'pairings', 'from'];
const toDoute = v => (Array.isArray(v) ? v.map(String).filter(k => DOUTE.includes(k)) : []);
const LABEL_AI = { grape: 'cépage', story: 'histoire', pairings: 'accords', from: 'garde', to: 'garde' };
function origins(v) {
  const o = {};
  if (v && typeof v === 'object') for (const k of AI_FIELDS) if (ORIGINS.includes(v[k])) o[k] = v[k];
  return o;
}
const vide = v => v === null || v === undefined || v === '' || (Array.isArray(v) && !v.length);
// L'IA peut écrire partout sauf dans une saisie de l'utilisateur (origine « user »). Les anciennes fiches sans origine sont réécrites
// (choix de l'utilisateur, option B) : les textes saisis avant la version 1.16.0 peuvent donc être remplacés.
function peutEcrire(w, src, k) {
  return src[k] !== 'user';
}
// Origines après une modification à la main : un champ changé devient « user », un champ vidé perd son origine.
export function editSrc(old, raw) {
  const nw = normalizeWine({ ...(old || {}), ...raw });
  const src = { ...((old && old.src) || {}) };
  for (const k of AI_FIELDS) {
    const avant = old ? old[k] : (k === 'pairings' ? [] : '');
    if (vide(nw[k]) && vide(avant)) continue;
    if (JSON.stringify(nw[k]) === JSON.stringify(avant)) continue;
    if (vide(nw[k])) delete src[k]; else src[k] = 'user';
  }
  return src;
}
// Applique une réponse de l'IA à une fiche (objet déjà copié). Ne touche jamais aux champs saisis par l'utilisateur.
// Marque la passe comme faite : une seule passe par vin, pas de rafraîchissement périodique.
// Champs à chercher sur le web : ceux que l'IA signale incertains et ceux restés vides. Une saisie de l'utilisateur n'est jamais concernée.
function calcDoutes(w, d) {
  const s = w.src || {};
  const out = new Set(toDoute(d.doute));
  if (vide(w.grape)) out.add('grape');
  if (vide(w.story)) out.add('story');
  if (vide(w.pairings)) out.add('pairings');
  if (vide(w.from) || vide(w.to)) out.add('from');
  return DOUTE.filter(k => out.has(k) && s[k] !== 'user');
}

// Champs à chercher pour cette fiche (calculés si la fiche vient d'avant cette version).
export function doutesEffectifs(w) {
  return Array.isArray(w.aiDoute) ? w.aiDoute : calcDoutes(w, {});
}

export function applyAi(w, d, now = Date.now()) {
  const src = { ...(w.src || {}) };
  const propose = {
    grape: str(d.grape), story: str(d.story),
    pairings: Array.isArray(d.pairings) ? d.pairings.map(str).filter(Boolean) : [],
    from: num(d.from), to: num(d.to),
  };
  for (const k of AI_FIELDS) {
    const v = propose[k];
    if (vide(v) || !peutEcrire(w, src, k)) continue;
    w[k] = v; src[k] = 'ai';
  }
  w.src = src;
  if (w.from && w.to && w.from > w.to) [w.from, w.to] = [w.to, w.from];
  if (d.conf) w.conf = w.conf === 'vérifiée' ? 'vérifiée' : d.conf;
  if (d.sources && d.sources.length) w.sources = d.sources;
  if (d.searched) { w.aiSearch = now; w.aiDoute = []; }
  else w.aiDoute = calcDoutes(w, d);
  if (d.estim && d.estim.min > 0) w.estim = toEstim({ min: d.estim.min, max: d.estim.max, date: now });
  w.aiPass = now; w.updated = now;
  return w;
}
// Libellés des champs que l'IA a mis à jour (pour l'indication sur la fiche).
export function aiFields(w) {
  const s = w.src || {}; const labels = [];
  for (const k of AI_FIELDS) if (s[k] === 'ai' && !vide(w[k]) && !labels.includes(LABEL_AI[k])) labels.push(LABEL_AI[k]);
  return labels;
}

// Bible : { v: 1, rows: [{ a: appellation, c: couleur R/B/D/E, y: { '2015': [qualité, apogée début, apogée fin, fiabilité] } }] }
export function bibleValid(j) {
  return !!j && j.v === 1 && Array.isArray(j.rows) && j.rows.length > 0
    && j.rows.every(r => r && typeof r.a === 'string' && typeof r.c === 'string' && r.y && typeof r.y === 'object');
}
const COLOR_BIBLE = { Rouge: ['R'], Blanc: ['B', 'D'], Pétillant: ['E'] };
// Entrée de la bible pour une fiche, seulement si la correspondance est claire : appellation exacte et couleur sans ambiguïté.
export function bibleEntry(w, bible) {
  if (!bibleValid(bible) || !w || !w.region || !w.year) return null;
  const want = COLOR_BIBLE[w.color];
  if (!want) return null;
  const name = norm(w.region);
  const rows = bible.rows.filter(r => norm(r.a) === name && want.includes(r.c));
  // Blanc : « B » (sec) ou « D » (doux) : si les deux existent pour cette appellation, on ne devine pas.
  if (rows.length !== 1) return null;
  const cell = rows[0].y[String(w.year)];
  if (!Array.isArray(cell) || typeof cell[0] !== 'number') return null;
  return { q: cell[0], from: cell[1], to: cell[2], f: cell[3] };
}
// Bible d'abord, à l'entrée d'un vin : la garde vient de la bible, sauf une garde saisie par l'utilisateur (origine « user »).
// Retourne true si la fiche a changé.
export function prefillFromBible(w, bible) {
  const e = bibleEntry(w, bible);
  if (!e) return false;
  const src = { ...(w.src || {}) }; let ch = false;
  if (src.from !== 'user' && w.from !== e.from) { w.from = e.from; src.from = 'bible'; ch = true; }
  if (src.to !== 'user' && w.to !== e.to) { w.to = e.to; src.to = 'bible'; ch = true; }
  if (!ch) return false;
  w.src = src;
  if (!w.conf) w.conf = 'estimée';
  return true;
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

// Valeur estimée de la cave : somme des milieux de fourchette × bouteilles, sur les vins déjà estimés seulement.
export function valeurEstimee(wines) {
  let total = 0, couverts = 0, bouteilles = 0;
  for (const w of wines) {
    if (!(w.qty > 0)) continue;
    bouteilles += w.qty;
    if (w.estim) { total += w.qty * (w.estim.min + w.estim.max) / 2; couverts += w.qty; }
  }
  return { total: Math.round(total), couverts, bouteilles };
}

const PLURIEL = { Rouge: 'rouges', Blanc: 'blancs', 'Rosé': 'rosés', 'Pétillant': 'pétillants' };
// Lecture de l'équilibre à partir des chiffres de Magic (sans IA) : des constats simples, jamais un jugement caché.
export function equilibre(c) {
  const n = c.bouteilles;
  if (!n) return '';
  const part = k => { const r = c.couleurs.find(x => x[0] === k); return r ? r[1] / n : 0; };
  const notes = [];
  const dom = [...c.couleurs].sort((a, b) => b[1] - a[1])[0];
  if (dom && dom[1] / n >= 0.75) notes.push(`très dominée par les ${PLURIEL[dom[0]] || dom[0].toLowerCase()}`);
  if (part('Blanc') + part('Rosé') + part('Pétillant') < 0.15 && !(dom && dom[0] !== 'Rouge' && dom[1] / n >= 0.75)) notes.push('peu riche en blancs, rosés ou pétillants');
  const reg = c.regions[0];
  if (reg && reg[1] / n >= 0.6) notes.push(`concentrée sur ${reg[0]}`);
  if (c.statuts.pret / n >= 0.5) notes.push('riche en vins prêts à boire');
  if (c.statuts.garder / n >= 0.6) notes.push('surtout composée de vins à garder, peu prêts à boire');
  if (c.statuts.urgence / n >= 0.2) notes.push('avec plusieurs bouteilles à boire vite');
  if (!notes.length) return 'Votre cave paraît plutôt équilibrée.';
  return 'Votre cave est ' + notes.join(', ') + '.';
}

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
