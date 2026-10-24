// Apogée : période optimale de consommation estimée à partir du millésime, de la couleur, de la région et de l'appellation.
// Règle du sommelier de l'appli (brouillon de l'utilisateur), complétée par l'expérience. Pure : hors connexion, sans IA.
import { norm } from './util.js';
import { reconnaitre, reperage, estEtranger } from './chiffres.js';
import { profil } from './profils.js';

// Nombre d'années après le millésime, avant le pic. La fenêtre d'apogée est pic ± 2 ans.
export const REGLES = {
  champagne: { ans: 10, label: 'champagne millésimé' },
  liquoreux: { ans: 20, label: 'vin liquoreux' },
  prestige: { ans: 15, label: 'grand cru ou grand vin' },
  premierCru: { ans: 12, label: 'premier cru' },
  cremant: { ans: 4, label: 'crémant ou mousseux' },
  rose: { ans: 2, label: 'rosé' },
  leger: { ans: 2, label: 'vin léger (IGP, Vin de France)' },
  rougeLeger: { ans: 4, label: 'rouge léger (Beaujolais, Loire)' },
  blancSec: { ans: 4, label: 'blanc sec' },
  blancBourgogne: { ans: 6, label: 'blanc de Bourgogne village' },
  blancBourgogneRegional: { ans: 4, label: 'blanc de Bourgogne régional' },
  rougeStructure: { ans: 8, label: 'rouge structuré (Bordeaux, Rhône, Bourgogne)' },
  rougeCourant: { ans: 6, label: 'rouge courant' },
  autre: { ans: 4, label: 'vin courant' },
};

// Mots-clés sur le nom, le domaine, le cépage et la région (texte normalisé : minuscules, sans accents).
const LIQUOREUX = /\bsauternes|barsac|monbazillac|layon|quarts? de chaume|bonnezeaux|tokaj|liquoreux|moelleux|vin de paille|pedro ximenez|\bporto\b|\bport\b|madere|vin jaune|jurancon|vendanges tardives|beerenauslese|eiswein|ice wine/;
const PREMIER_CRU = /premier cru|1er cru/;
const PRESTIGE = /grand cru|grands crus|chateauneuf|hermitage|cote rotie|cornas|barolo|barbaresco|brunello|gran reserva|chateau (margaux|latour|lafite|mouton|haut[ -]brion|petrus|cheval blanc|ausone|angelus)|mouton rothschild|montrachet|romanee|chambertin|musigny|echezeaux|richebourg/;
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
  else if (PREMIER_CRU.test(texte)) r = REGLES.premierCru;
  else if (w.color === 'Pétillant') r = REGLES.cremant;
  else if (w.color === 'Rosé') r = REGLES.rose;
  else if (VIN_LEGER.test(texte)) r = REGLES.leger;
  else if (w.color === 'Rouge') {
    if (grande === 'Beaujolais' || grande === 'Vallée de la Loire') r = REGLES.rougeLeger;
    else if (grande === 'Bordeaux' || grande === 'Vallée du Rhône' || grande === 'Bourgogne') r = REGLES.rougeStructure;
    else r = REGLES.rougeCourant;
  } else if (w.color === 'Blanc') {
    // Bourgogne régional (« Bourgogne », Aligoté, Hautes-Côtes…) : 4 ans. Village (Meursault, Chablis…) : 6 ans. Inconnu : prudence, régional.
    const regional = !app || /^bourgogne/.test(norm(app[0]));
    r = grande === 'Bourgogne' ? (regional ? REGLES.blancBourgogneRegional : REGLES.blancBourgogne) : REGLES.blancSec;
  }
  else r = REGLES.autre;

  let pic = millesime + r.ans;
  let from = pic - 2; let to = pic + 2;
  // Cohérence : l'apogée ne sort jamais de la fenêtre de garde enregistrée (saisie, bible ou IA).
  // Si la règle tombe en dehors, le pic est ramené dans la fenêtre et la période d'apogée est recoupée avec elle.
  let ajuste = false;
  const wf = Number(w.from) > 0 ? Number(w.from) : null;
  const wt = Number(w.to) > 0 ? Number(w.to) : null;
  if (!(wf && wt && wf > wt)) {
    if (wf && pic < wf) { pic = wf; ajuste = true; }
    if (wt && pic > wt) { pic = wt; ajuste = true; }
    if (ajuste || (wf && from < wf) || (wt && to > wt)) {
      from = Math.max(from, wf || from); to = Math.min(to, wt || to);
      if (from > to) { from = pic; to = pic; }
      from = Math.min(from, pic); to = Math.max(to, pic);
    }
  }
  const statut = annee < from ? 'À garder' : annee > to ? 'Urgence' : 'Prêt à boire';
  return { pic, from, to, statut, regle: r.label, ans: r.ans, sansMillesime: false, ajuste };
}

// Où en est l'apogée elle-même (et non le statut du vin, qui dépend de la fenêtre de garde) : évite de contredire la pastille de la carte.
const ETAT = { 'À garder': 'à venir', 'Prêt à boire': 'en cours', 'Urgence': 'dépassée' };

// Phrase affichée dans la fiche du vin.
export function apogeeTexte(a) {
  if (a.sansMillesime) return 'Sans millésime : prêt à boire.';
  const plage = a.from === a.to ? '' : ` (entre ${a.from} et ${a.to})`;
  return `Apogée estimée ${a.pic}${plage} : ${ETAT[a.statut]}. Règle : ${a.regle}, +${a.ans} ans après le millésime.${a.ajuste ? ' Ramenée dans la fenêtre de garde enregistrée.' : ''}`;
}

// Rappel court affiché dans la fiche dépliée du vin.
export function apogeeCourte(a) {
  if (a.sansMillesime) return 'Prêt à boire (sans millésime)';
  return `Apogée ${a.pic} · ${ETAT[a.statut]}`;
}

// Température de service conseillée { min, max } en °C, ou null si la couleur est inconnue.
// Repères de l'appellation quand ils existent ; sinon règle générale par couleur et style (usages classiques du service).
export function service(w) {
  if (!w) return null;
  const pr = profil(w);
  if (pr) return { min: pr.tmin, max: pr.tmax, appellation: true };
  const texte = norm([w.name, w.dom, w.grape, w.region].join(' | '));
  const r = (min, max) => ({ min, max, appellation: false });
  // Vin jaune : se sert presque tempéré (avant la règle des liquoreux, qui le contient).
  if (/chateau[- ]chalon|vin jaune/.test(texte)) return r(14, 16);
  if (LIQUOREUX.test(texte)) return r(8, 10);
  const app = w.region ? reconnaitre(String(w.region)) : null;
  const grande = app ? app[2] : (w.region && !estEtranger(String(w.region)) ? reperage(String(w.region)) : null);
  const champagne = grande === 'Champagne' || /champagne/.test(texte);
  if (w.color === 'Pétillant') return champagne ? r(8, 10) : r(6, 8);
  if (w.color === 'Rosé') return r(8, 10);
  const rouge = w.color === 'Rouge', blanc = w.color === 'Blanc';
  if (!rouge && !blanc) return null;
  if (PRESTIGE.test(texte)) return rouge ? r(16, 18) : r(11, 13);
  if (PREMIER_CRU.test(texte)) return rouge ? r(16, 18) : r(10, 12);
  if (VIN_LEGER.test(texte)) return rouge ? r(14, 16) : r(8, 10);
  if (rouge) {
    if (grande === 'Beaujolais' || grande === 'Vallée de la Loire') return r(13, 15);
    if (grande === 'Bordeaux' || grande === 'Vallée du Rhône' || grande === 'Bourgogne') return r(16, 18);
    return r(15, 17);
  }
  const regional = !app || /^bourgogne/.test(norm(app[0]));
  return grande === 'Bourgogne' && !regional ? r(10, 12) : r(8, 10);
}

export function serviceTexte(w) {
  const s = service(w);
  return s ? `Service : ${s.min} à ${s.max} °C.` : '';
}
