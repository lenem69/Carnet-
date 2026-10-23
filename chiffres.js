// « Magic » (ma cave en chiffres) : calculs purs, sans IA, sans réseau. Testés dans tests/unit.mjs.
// Hiérarchie stricte : Région (grande région, via taxonomie.js) > Appellation > Cépage (libellé normalisé).
import { COLORS, urgent } from './logic.js';
import { TAXONOMIE } from './taxonomie.js';

export const HORS_REFERENTIEL = 'Vin de France';
export const ETRANGER = 'Étranger';
// Vins étrangers reconnus à leur nom, pays ou cépage typique (le fichier ne donne pas toujours le pays).
const ETRANGERS = /\b(italie|italia|espagne|hongrie|hongroise|tcheque|moravsk\w*|slovaquie|chili|argentine|afrique du sud|australie|etats unis|usa|allemagne|autriche|portugal|nouvelle zelande|grece|georgie|liban|suisse|roumanie|slovenie|croatie|moldavie|bresil|uruguay|canada|japon|chine|inde|maroc|israel|bulgarie|serbie|mexique|bolivie|perou|riesling|tokaj\w*|valpolicell\w*|chianti|brunello|barolo|barbaresco|rioja|ribera|priorat|douro|rias baixas|rheingau|mosel|pfalz|vino|docg?|sekt|tempranillo|sangiovese|nebbiolo|malbec|carmenere|pinot grigio|prosecco|lambrusco|verdejo|albarino|gruner|zweigelt|furmint|xinomavro|assyrtiko|touriga|mencia|garnacha|kadarka|bull s blood)\b/;
export const estEtranger = region => ETRANGERS.test(plain(region).replace(/[-']/g, ' '));
// Repérage par nom de région quand l'appellation n'est pas reconnue (IGP, mentions régionales).
const REPERES = [
  [/\b(herault|languedoc|gard|bellegarde|pezenas|corbieres|minervois|roussillon|fitou|pic saint loup)\b/, 'Languedoc-Roussillon'],
  [/\b(allobroges|savoie|bugey|jura|seyssel|chignin|arbois|cerdon)\b/, 'Sud-Ouest, Jura, Savoie'],
  [/\b(bergerac|cahors|gaillac|madiran|jurancon|marcillac|tursan|bearn|monbazillac)\b/, 'Sud-Ouest, Jura, Savoie'],
  [/\b(loire|touraine|anjou|saumur|muscadet|sancerre|chinon|vouvray|layon|savennieres)\b/, 'Vallée de la Loire'],
];
export const reperage = region => { const p = plain(region); const r = REPERES.find(([re]) => re.test(p)); return r ? r[1] : null; };
// Mentions courantes qui ne changent pas l'appellation (« Volnay 1er cru » = « Volnay »).
const MENTIONS = [/\b(aop|aoc|igp)\b/g, /\b(premier|1er|1 er) cru\b/g, /\bgrand cru( classe)?\b/g, /\bvieilles? vig\w*/g, /\bhaute cuvee\b/g];
const cleanKey = s => { let t = plain(s).replace(/\bcote du\b/g, 'cotes du'); for (const re of MENTIONS) t = t.replace(re, ' '); return t.replace(/[^a-z0-9]/g, ''); };
// Appellation reconnue : exacte d'abord, puis après retrait des mentions (1er cru, Grand cru, AOP…).
let _noms = null;
// Noms de référence sans mentions, pour les recherches souples.
function noms() {
  if (!_noms) _noms = Object.entries(TAXONOMIE).map(([k, v]) => [cleanKey(v[0]) || k, v]).filter(([c]) => c);
  return _noms;
}
function distance(a, b) {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[b.length];
}
// Appellation reconnue, même écrite avec des fautes ou avec une précision en plus.
// Ordre : exacte, sans mentions, début de nom (« Mâcon Pierreclos »), nom contenu (« Hautes-Côtes de Beaune »), faute de frappe.
export function reconnaitre(region) {
  const exact = TAXONOMIE[keyOf(region)];
  if (exact) return exact;
  const c = cleanKey(region);
  if (!c) return null;
  const exactC = TAXONOMIE[c];
  if (exactC) return exactC;
  const liste = noms();
  let best = null;
  for (const [n, v] of liste) if (n.length >= 4 && c.startsWith(n) && (!best || n.length > best[0].length)) best = [n, v];
  if (best) return best[1];
  // Rapprochement approximatif seulement pour un nom non étranger (« Riesling » ne doit pas devenir Alsace).
  if (estEtranger(region)) return null;
  if (c.length >= 8) {
    for (const [n, v] of liste) if (n.length >= c.length && n.includes(c) && (!best || n.length < best[0].length)) best = [n, v];
    if (best) return best[1];
  }
  const seuil = c.length < 8 ? 1 : 2;
  let fuzzy = null;
  for (const [n, v] of liste) { const d = distance(c, n); if (d <= seuil && (!fuzzy || d < fuzzy.d)) fuzzy = { d, v }; }
  return fuzzy ? fuzzy.v : null;
}
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
    const t = reconnaitre(w.region);
    const macro = t ? t[2] : (reperage(w.region) || (estEtranger(w.region) ? ETRANGER : HORS_REFERENTIEL));
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
