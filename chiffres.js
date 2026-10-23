// « Magic » (ma cave en chiffres) : calculs purs, sans IA, sans réseau. Testés dans tests/unit.mjs.
// Hiérarchie stricte : Région (grande région, via taxonomie.js) > Appellation > Cépage (libellé normalisé).
import { COLORS, urgent } from './logic.js';
import { TAXONOMIE } from './taxonomie.js';

export const HORS_REFERENTIEL = 'Hors référentiel';
const SANS_APPELLATION = 'Sans appellation';
const SYN = { shiraz: 'syrah', cabsauvignon: 'cabernet sauvignon', cabsauv: 'cabernet sauvignon', cabernetsauv: 'cabernet sauvignon', cabfranc: 'cabernet franc', gamaynoir: 'gamay', grenachenoir: 'grenache', pinotnoir: 'pinot noir' };
const plain = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const keyOf = s => plain(s).replace(/[^a-z0-9]/g, '');
const top = (map, n) => [...map.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'fr')).slice(0, n);
const bump = (map, key, by) => { if (key) map.set(key, (map.get(key) || 0) + by); };
const pct = (part, total) => (total ? Math.round((part / total) * 100) : 0);

// Libellé de cépage standardisé : « 100% Syrah », « syrah » → « Syrah ». Retourne { key, label }.
export function cepage(v) {
  let s = String(v || '').replace(/\d+\s*%/g, ' ').replace(/\s+/g, ' ').trim().replace(/[.,;]+$/, '').trim();
  const k0 = keyOf(s);
  if (!k0) return null;
  const canon = SYN[k0] || s;
  return { key: keyOf(canon), label: canon.charAt(0).toUpperCase() + canon.slice(1).toLowerCase() };
}

// Statut actionnable, mêmes règles que logic.js › status().
export function statutOf(w, year) {
  if (!w.from && !w.to) return 'sans';
  if (w.from && year < w.from) return 'garder';
  if (w.to && w.to <= year + 1) return 'urgence';
  return 'pret';
}

export function chiffres(wines, year, horizon = 20) {
  const stock = wines.filter(w => w.qty > 0);
  const bottles = stock.reduce((s, w) => s + w.qty, 0);
  const couleur = new Map(), region = new Map(), appellation = new Map(), appMacro = new Map();
  const cepageN = new Map(), cepageLabel = new Map(), millesime = new Map(), frise = new Map();
  const statuts = { pret: 0, garder: 0, urgence: 0, sans: 0 };
  let valeur = 0, sansPrix = 0, sansFenetre = 0;
  for (const w of stock) {
    bump(couleur, w.color || 'Autre', w.qty);
    const t = TAXONOMIE[keyOf(w.region)];
    const macro = t ? t[2] : HORS_REFERENTIEL;
    const app = t ? t[0] : (String(w.region || '').trim() || SANS_APPELLATION);
    bump(region, macro, w.qty);
    bump(appellation, app, w.qty);
    appMacro.set(app, macro);
    const c = cepage(w.grape);
    if (c) { bump(cepageN, c.key, w.qty); if (!cepageLabel.has(c.key)) cepageLabel.set(c.key, c.label); }
    bump(millesime, w.year ? String(Math.floor(w.year / 10) * 10) + 's' : '', w.qty);
    if (w.price) valeur += w.qty * w.price; else sansPrix += w.qty;
    const st = statutOf(w, year);
    statuts[st] += w.qty;
    if (st === 'sans') { sansFenetre += w.qty; continue; }
    const a = Math.max(w.from || year, year), b = Math.min(w.to || w.from, year + horizon - 1);
    for (let y = a; y <= b; y++) bump(frise, y, w.qty);
  }
  const years = Array.from({ length: horizon }, (_, i) => year + i).map(y => [y, frise.get(y) || 0]);
  const peak = years.reduce((p, c) => (c[1] > p[1] ? c : p), [year, 0]);
  const cepages = [...cepageN.entries()].map(([k, n]) => [cepageLabel.get(k), n]).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'fr'));
  return {
    bouteilles: bottles,
    references: stock.length,
    portrait: bottles
      ? `${bottles} bouteille${bottles > 1 ? 's' : ''} pour ${stock.length} référence${stock.length > 1 ? 's' : ''}, dont ${pct(couleur.get('Rouge') || 0, bottles)} % de rouges.`
      : 'Votre cave est vide : ajoutez des bouteilles pour voir les chiffres.',
    statuts,
    couleurs: COLORS.map(c => [c, couleur.get(c) || 0]).filter(x => x[1] > 0),
    regions: top(region, 12),
    appellations: top(appellation, 8).map(([a, n]) => [a, n, appMacro.get(a)]),
    cepages: cepages.slice(0, 8),
    decennies: [...millesime.entries()].sort((a, b) => a[0].localeCompare(b[0])),
    frise: years,
    pic: peak[1] ? { annee: peak[0], bouteilles: peak[1] } : null,
    sansFenetre,
    diversite: { regions: region.size, cepages: cepageN.size, partRegionTop: top(region, 1)[0] ? pct(top(region, 1)[0][1], bottles) : 0 },
    valeur: { total: Math.round(valeur * 100) / 100, sansPrix },
    aBoireVite: stock.filter(w => urgent(w, year)).reduce((s, w) => s + w.qty, 0),
  };
}
