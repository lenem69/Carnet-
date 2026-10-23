// « Ma cave en chiffres » : calculs purs, sans IA, sans réseau. Testés dans tests/unit.mjs.
import { COLORS, urgent } from './logic.js';

const top = (map, n) => [...map.entries()].sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0]), 'fr')).slice(0, n);
const bump = (map, key, by) => { if (key) map.set(key, (map.get(key) || 0) + by); };
const pct = (part, total) => (total ? Math.round((part / total) * 100) : 0);

export function chiffres(wines, year, horizon = 20) {
  const stock = wines.filter(w => w.qty > 0);
  const bottles = stock.reduce((s, w) => s + w.qty, 0);
  const couleur = new Map(), region = new Map(), cepage = new Map(), millesime = new Map(), frise = new Map();
  let valeur = 0, sansPrix = 0, sansFenetre = 0;
  for (const w of stock) {
    bump(couleur, w.color || 'Autre', w.qty);
    bump(region, w.region, w.qty);
    bump(cepage, w.grape, w.qty);
    bump(millesime, w.year ? String(Math.floor(w.year / 10) * 10) + 's' : '', w.qty);
    if (w.price) valeur += w.qty * w.price; else sansPrix += w.qty;
    if (!w.to && !w.from) { sansFenetre += w.qty; continue; }
    const a = Math.max(w.from || year, year), b = Math.min(w.to || w.from, year + horizon - 1);
    for (let y = a; y <= b; y++) bump(frise, y, w.qty);
  }
  const years = Array.from({ length: horizon }, (_, i) => year + i).map(y => [y, frise.get(y) || 0]);
  const peak = years.reduce((p, c) => (c[1] > p[1] ? c : p), [year, 0]);
  const regionTop = top(region, 1)[0];
  const colours = COLORS.map(c => [c, couleur.get(c) || 0]).filter(x => x[1] > 0);
  const dominante = top(couleur, 1)[0];
  const soon = stock.filter(w => urgent(w, year)).reduce((s, w) => s + w.qty, 0);
  const adn = [];
  if (dominante) adn.push(`Couleur dominante : ${dominante[0]} (${pct(dominante[1], bottles)} %)`);
  if (regionTop) adn.push(`Première région : ${regionTop[0]} (${pct(regionTop[1], bottles)} %)`);
  if (top(cepage, 1)[0]) adn.push(`Cépage le plus présent : ${top(cepage, 1)[0][0]}`);
  return {
    bouteilles: bottles,
    references: stock.length,
    portrait: bottles
      ? `${bottles} bouteille${bottles > 1 ? 's' : ''} pour ${stock.length} référence${stock.length > 1 ? 's' : ''}, dont ${pct(couleur.get('Rouge') || 0, bottles)} % de rouges.`
      : 'Votre cave est vide : ajoutez des bouteilles pour voir les chiffres.',
    couleurs: colours,
    regions: top(region, 8),
    cepages: top(cepage, 8),
    decennies: [...millesime.entries()].sort((a, b) => a[0].localeCompare(b[0])),
    frise: years,
    pic: peak[1] ? { annee: peak[0], bouteilles: peak[1] } : null,
    sansFenetre,
    diversite: { regions: region.size, cepages: cepage.size, partRegionTop: regionTop ? pct(regionTop[1], bottles) : 0 },
    valeur: { total: Math.round(valeur * 100) / 100, sansPrix },
    aBoireVite: soon,
    adn,
  };
}
