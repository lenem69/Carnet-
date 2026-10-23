// Apogée : période optimale de consommation estimée à partir du millésime, de la couleur, de la région et de l'appellation.
// Règle du sommelier de l'appli (brouillon de l'utilisateur), complétée par l'expérience. Pure : hors connexion, sans IA.
import { norm } from './util.js';
import { reconnaitre, reperage, estEtranger } from './chiffres.js';

// Nombre d'années après le millésime, avant le pic. La fenêtre d'apogée est pic ± 2 ans.
export const REGLES = {
  champagne: { ans: 10, label: 'champagne millésimé' },
  liquoreux: { ans: 20, label: 'vin liquoreux' },
  prestige: { ans: 15, label: 'grand cru, premier cru ou grand vin' },
  cremant: { ans: 4, label: 'crémant ou mousseux' },
  rose: { ans: 2, label: 'rosé' },
  leger: { ans: 2, label: 'vin léger (IGP, Vin de France)' },
  rougeLeger: { ans: 4, label: 'rouge léger (Beaujolais, Loire)' },
  blancSec: { ans: 4, label: 'blanc sec' },
  blancBourgogne: { ans: 8, label: 'blanc de Bourgogne' },
  rougeStructure: { ans: 8, label: 'rouge structuré (Bordeaux, Rhône, Bourgogne)' },
  rougeCourant: { ans: 6, label: 'rouge courant' },
  autre: { ans: 4, label: 'vin courant' },
};

// Mots-clés sur le nom, le domaine, le cépage et la région (texte normalisé : minuscules, sans accents).
const LIQUOREUX = /\bsauternes|barsac|monbazillac|layon|quarts? de chaume|bonnezeaux|tokaj|liquoreux|moelleux|vin de paille|pedro ximenez|\bporto\b|\bport\b|madere|vin jaune|jurancon|vendanges tardives|beerenauslese|eiswein|ice wine/;
const PRESTIGE = /grand cru|grands crus|premier cru|1er cru|chateauneuf|hermitage|cote rotie|cornas|barolo|barbaresco|brunello|gran reserva|chateau (margaux|latour|lafite|mouton|haut[ -]brion|petrus|cheval blanc|ausone|angelus)|mouton rothschild|montrachet|romanee|chambertin|musigny|echezeaux|richebourg/;
const VIN_LEGER = /\bigp\b|indication geographique|pays d.oc|vin de france|\bvdf\b|vin de pays|vin de table/;

const ANNEE_MIN = 1900; const ANNEE_MAX = 2035;

// Calcule l'apogée d'un vin. annee = année en cours (pour le statut).
// Renvoie { pic, from, to, statut, regle, ans, sansMillesime }.
export function apogee(w, annee = new Date().getFullYear()) {
  const texte = norm([w.name, w.dom, w.grape, w.region].join(' | '));
  // Sans millésime (ex. Champagne brut non millésimé) : prêt à boire dès maintenant.
  const millesime = Number(w.year);
  if (!w.year || !Number.isInteger(millesime) || millesime < ANNEE_MIN || millesime > ANNEE_MAX) {
    return { pic: null, from: null, to: null, statut: 'Prêt à boire', regle: 'sans millésime', ans: null, sansMillesime: true };
  }
  // Région : appellation reconnue en priorité, sinon grande région repérée par mots-clés. Un vin étranger n'en a pas.
  const app = w.region ? reconnaitre(String(w.region)) : null;
  const grande = app ? app[2] : (w.region && !estEtranger(String(w.region)) ? reperage(String(w.region)) : null);
  const champagne = grande === 'Champagne' || /champagne/.test(texte);

  let r;
  if (LIQUOREUX.test(texte)) r = REGLES.liquoreux;
  else if (w.color === 'Pétillant' && champagne) r = REGLES.champagne;
  else if (PRESTIGE.test(texte)) r = REGLES.prestige;
  else if (w.color === 'Pétillant') r = REGLES.cremant;
  else if (w.color === 'Rosé') r = REGLES.rose;
  else if (VIN_LEGER.test(texte)) r = REGLES.leger;
  else if (w.color === 'Rouge') {
    if (grande === 'Beaujolais' || grande === 'Vallée de la Loire') r = REGLES.rougeLeger;
    else if (grande === 'Bordeaux' || grande === 'Vallée du Rhône' || grande === 'Bourgogne') r = REGLES.rougeStructure;
    else r = REGLES.rougeCourant;
  } else if (w.color === 'Blanc') r = grande === 'Bourgogne' ? REGLES.blancBourgogne : REGLES.blancSec;
  else r = REGLES.autre;

  const pic = millesime + r.ans;
  const from = pic - 2; const to = pic + 2;
  const statut = annee < from ? 'À garder' : annee > to ? 'Urgence' : 'Prêt à boire';
  return { pic, from, to, statut, regle: r.label, ans: r.ans, sansMillesime: false };
}

// Phrase affichée dans la fiche du vin.
export function apogeeTexte(a) {
  if (a.sansMillesime) return 'Sans millésime : prêt à boire.';
  return `Apogée estimée ${a.pic} (entre ${a.from} et ${a.to}) : ${a.statut.toLowerCase()}. Règle : ${a.regle}, +${a.ans} ans après le millésime.`;
}
