// Repères par appellation (cépages, température de service, accords classiques) pour 18 couples appellation-couleur
// du Sud-Ouest, du Jura et de la Savoie. Affichage seulement : rien n’est écrit dans la fiche du vin, aucune IA.
// Un vin n’a de repères que si son appellation et sa couleur désignent UNE seule ligne (jamais de devinette :
// « Jurançon » blanc peut être sec ou moelleux, il n’a donc pas de repères).
import { norm } from './util.js';
import { REPERES, FAMILLES } from './reperes.js';

// [appellation, couleur (R B D E), cépages, service min, service max, accords]
const P = [
  ['Monbazillac', 'D', 'Sémillon, Sauvignon, Muscadelle', 10, 12, 'Foie gras, bleu des Causses, desserts aux fruits'],
  ['Pécharmant', 'R', 'Merlot, Cabernet sauvignon, Cabernet franc, Malbec', 16, 18, 'Viandes rouges grillées, confit de canard, gibiers'],
  ['Saussignac', 'D', 'Sémillon, Sauvignon, Muscadelle', 10, 12, 'Foie gras poêlé, Roquefort, tarte Tatin'],
  ['Cahors', 'R', 'Malbec (Côt), Merlot, Tannat', 16, 18, 'Magret de canard, truffe noire du Quercy, cassoulet'],
  ['Madiran', 'R', 'Tannat, Cabernet franc, Cabernet sauvignon', 16, 18, 'Pièce de bœuf braisée, confit d’oie, plats en sauce'],
  ['Jurançon', 'B', 'Gros manseng, Petit manseng, Courbu', 8, 10, 'Poissons en sauce, crustacés, volailles'],
  ['Jurançon', 'D', 'Petit manseng, Gros manseng', 10, 12, 'Foie gras, fromage de brebis des Pyrénées, desserts aux agrumes'],
  ['Arbois', 'R', 'Poulsard, Trousseau, Pinot noir', 14, 16, 'Charcuteries jurassiennes, saucisse de Morteau, volailles'],
  ['Arbois', 'B', 'Chardonnay, Savagnin', 11, 13, 'Poulet aux morilles, Comté affiné, poissons d’eau douce'],
  ['Côtes du Jura', 'R', 'Poulsard, Trousseau, Pinot noir', 14, 16, 'Viandes blanches, gratin jurassien, terrines de campagne'],
  ['Côtes du Jura', 'B', 'Chardonnay, Savagnin', 11, 13, 'Truite au bleu, quenelles de brochet, fondue comtoise'],
  ['L’Étoile', 'B', 'Chardonnay, Savagnin', 11, 13, 'Coquillages, poissons nobles, volaille à la crème'],
  ['Château-Chalon', 'B', 'Savagnin (vin jaune)', 14, 16, 'Coq au vin jaune, Comté vieux (24-36 mois), cuisine aux épices'],
  ['Crémant du Jura', 'E', 'Chardonnay, Pinot noir, Savagnin', 8, 10, 'Apéritif dinatoire, fondue au Comté, desserts légers'],
  ['Roussette de Savoie', 'B', 'Altesse', 8, 10, 'Diots de Savoie, tartiflette, poissons du lac Léman'],
  ['Bugey', 'R', 'Gamay, Mondeuse, Pinot noir', 16, 17, 'Charcuteries fines, viandes rouges, volailles rôties'],
  ['Bugey', 'B', 'Chardonnay, Altesse', 9, 11, 'Poissons d’eau douce, cuisses de grenouilles, ramequin du Bugey'],
  ['Seyssel', 'B', 'Altesse (Roussette), Molette', 8, 10, 'Fromages de Savoie, charcuteries, entrées chaudes'],
];

const COULEURS = { Rouge: ['R'], Blanc: ['B', 'D'], 'Pétillant': ['E'] };
const cle = s => norm(String(s || '').replace(/’/g, "'"));

export function profil(w) {
  if (!w || !w.region || !COULEURS[w.color]) return null;
  const nom = cle(w.region);
  const l = P.filter(p => cle(p[0]) === nom && COULEURS[w.color].includes(p[1]));
  if (l.length !== 1) return null;
  const [appellation, , cepages, tmin, tmax, accords] = l[0];
  return { appellation, cepages, tmin, tmax, accords };
}

// Repères PAR APPELLATION dérivés d'un fichier de référence (voir data/construire-reperes.py) : service, carafage, cépage d'une appellation à cépage unique,
// familles d'accords. Fiabilité B. Rang du vin : 'v' village (ou régionale), 'p' premier cru, 'g' grand cru. Sans correspondance exacte de niveau : rien (jamais le village pour un grand cru).
const MOTS = /\b(aoc|aop|ac|appellation|controlee?|protegee|origine|d)\b/g;
const cleR = s => norm(String(s || '').replace(/[’'-]/g, ' ')).replace(MOTS, ' ').replace(/\s+/g, ' ').trim();
const COUL_R = { Rouge: 'R', Blanc: 'B' };
export function repere(w, niv) {
  if (!w || !w.region || !COUL_R[w.color]) return null;
  const t0 = cleR(w.region);
  const texteNv = /\bgrand cru\b/.test(t0) ? 'g' : /\b(1er|premier) cru\b/.test(t0) ? 'p' : 'v';
  const t = t0.replace(/\b(1er|premier|grand) cru\b/g, ' ').replace(/\s+/g, ' ').trim();
  // Le rang calculé par l'appli est essayé d'abord (Clos de Vougeot sans la mention « Grand Cru »), puis celui qu'annonce le texte (Barolo n'est pas un « grand cru »).
  for (const nv of new Set([niv, texteNv].filter(Boolean))) {
    let best = null;
    for (const k of Object.keys(REPERES)) {
      const [base, n, c] = k.split('|');
      if (n !== nv || c !== COUL_R[w.color]) continue;
      // village : l'appellation seule (ou « Alsace » suivi d'un cépage) ; premier et grand cru : le lieu-dit peut suivre
      const ok = t === base || ((nv !== 'v' || base === 'alsace') && t.startsWith(base + ' '));
      if (ok && (!best || base.length > best[0].length)) best = [base, REPERES[k]];
    }
    if (best) return { ...best[1], appellation: best[0] };
  }
  return null;
}
export const accordsRepere = r => (r && r.a ? r.a.map(k => FAMILLES[k]).filter(Boolean) : []);
