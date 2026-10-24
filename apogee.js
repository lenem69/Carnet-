// Apogée : période optimale de consommation estimée à partir du millésime, de la couleur, de la région et de l'appellation.
// Règle du sommelier de l'appli (brouillon de l'utilisateur), complétée par l'expérience. Pure : hors connexion, sans IA.
import { norm } from './util.js';
import { reconnaitre, reperage, estEtranger } from './chiffres.js';
import { profil } from './profils.js';
import { TABLE_APOGEE } from './apogee-table.js';

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
const LIQUOREUX = /\bsauternes|barsac|monbazillac|layon|aubance|quarts? de chaume|bonnezeaux|tokaj|liquoreux|moelleux|vin de paille|pedro ximenez|\bporto\b(?! vecchio)|\bport\b|madere|vin jaune|jurancon(?! sec)|vendanges tardives|grains nobles|beerenauslese|eiswein|ice wine/;
const PREMIER_CRU = /premier cru|1er cru/;
const PRESTIGE = /grand cru|grands crus|barolo|barbaresco|brunello|gran reserva|chateau (margaux|latour|lafite|mouton|haut brion|petrus|cheval blanc|ausone|angelus)|mouton rothschild|montrachet|romanee|chambertin|musigny|echezeaux|richebourg/;
const VIN_LEGER = /\bigp\b|indication geographique|pays d.oc|vin de france|\bvdf\b|vin de pays|vin de table/;

const ANNEE_MIN = 1900; const ANNEE_MAX = 2035;

// Un village n'est pas un grand cru : « Chassagne-Montrachet », « Gevrey-Chambertin », « Chambolle-Musigny », « Vosne-Romanée », « Puligny-Montrachet »,
// « Crozes-Hermitage » et « Saint-Émilion Grand Cru » contiennent le nom d'un grand cru ou d'un terme de prestige sans en être un.
const VILLAGES = /\b(chassagne|puligny|gevrey|chambolle|vosne|crozes) (montrachet|chambertin|musigny|romanee|hermitage)\b/g;
const cleTexte = t => norm(t).replace(/[-'’]/g, ' ').replace(/\s+/g, ' ').trim();
export function texteVin(w) {
  return cleTexte([w.name, w.dom, w.grape, w.region].join(' | ')).replace(VILLAGES, '$1').replace(/saint emilion grand cru/g, 'saint emilion');
}

// Règle propre à chaque appellation (années après le millésime) : [rouge, blanc], null = non concerné.
// Valable pour le niveau « village » ou le vin de l'appellation ; 1er cru et grand cru ont leurs propres règles (voir niveau).
const PAR_APPELLATION = {
  // Bourgogne
  'bourgogne': [5, 4], 'bourgogne aligote': [null, 3], 'bourgogne hautes cotes de nuits': [6, 5], 'hautes cotes de nuits': [6, 5], 'hautes cotes de beaune': [6, 5],
  'marsannay': [6, 4], 'fixin': [8, 6], 'gevrey chambertin': [9, null], 'morey saint denis': [9, 8], 'chambolle musigny': [8, null], 'vosne romanee': [10, null],
  'nuits saint georges': [9, 6], 'aloxe corton': [9, 7], 'pernand vergelesses': [7, 6], 'savigny les beaune': [7, 5], 'beaune': [8, 6], 'pommard': [10, null],
  'volnay': [9, null], 'monthelie': [7, 6], 'auxey duresses': [6, 6], 'saint romain': [5, 5], 'meursault': [6, 6], 'puligny montrachet': [null, 7],
  'chassagne montrachet': [8, 7], 'saint aubin': [6, 6], 'santenay': [7, 5], 'maranges': [6, null], 'mercurey': [6, 5], 'givry': [5, 4], 'rully': [5, 4],
  'montagny': [null, 4], 'pouilly fuisse': [null, 6], 'saint veran': [null, 4], 'macon': [3, 3], 'chablis': [null, 6], 'petit chablis': [null, 3], 'irancy': [6, null],
  // Bordeaux
  'bordeaux': [4, 3], 'bordeaux superieur': [5, 3], 'entre deux mers': [null, 2], 'medoc': [8, null], 'haut medoc': [9, null], 'listrac medoc': [9, null], 'moulis en medoc': [9, null],
  'pauillac': [13, null], 'saint julien': [13, null], 'saint estephe': [12, null], 'margaux': [12, null], 'pessac leognan': [11, 7], 'graves': [9, 5],
  'pomerol': [12, null], 'lalande de pomerol': [9, null], 'saint emilion': [9, null], 'saint emilion grand cru': [11, null], 'lussac saint emilion': [7, null],
  'montagne saint emilion': [7, null], 'puisseguin saint emilion': [7, null], 'saint georges saint emilion': [7, null], 'fronsac': [8, null], 'canon fronsac': [9, null],
  'cotes de bourg': [7, null], 'blaye': [6, null], 'cotes de blaye': [6, 3], 'blaye cotes de bordeaux': [6, null], 'castillon cotes de bordeaux': [7, null],
  'cotes de bordeaux': [6, 3], 'francs cotes de bordeaux': [6, null], 'loupiac': [null, 15], 'sainte croix du mont': [null, 15], 'cadillac': [null, 12], 'cerons': [null, 12],
  // Rhône
  'hermitage': [15, 12], 'cote rotie': [12, null], 'cornas': [12, null], 'saint joseph': [7, 5], 'crozes hermitage': [5, 4], 'condrieu': [null, 3],
  'chateau grillet': [null, 6], 'saint peray': [null, 4], 'chateauneuf du pape': [12, 7], 'gigondas': [10, null], 'vacqueyras': [8, 4], 'lirac': [6, 3],
  'cairanne': [6, 3], 'rasteau': [7, null], 'vinsobres': [7, null], 'beaumes de venise': [6, null], 'cotes du rhone villages': [4, 3], 'cotes du rhone': [3, 3],
  'ventoux': [4, 3], 'luberon': [4, 3], 'costieres de nimes': [4, 3],
  // Loire
  'chinon': [7, 5], 'bourgueil': [7, null], 'saint nicolas de bourgueil': [7, null], 'saumur champigny': [7, null], 'saumur': [4, 5], 'anjou': [4, 5],
  'anjou villages': [5, null], 'anjou villages brissac': [6, null], 'savennieres': [null, 10], 'savennieres coulee de serrant': [null, 12], 'savennieres roche aux moines': [null, 10],
  'vouvray': [null, 8], 'montlouis sur loire': [null, 7], 'jasnieres': [null, 8], 'sancerre': [4, 4], 'pouilly fume': [null, 4], 'menetou salon': [4, 3], 'quincy': [null, 3],
  'reuilly': [3, 3], 'muscadet': [null, 3], 'muscadet sevre et maine': [null, 4], 'touraine': [3, 3], 'cheverny': [3, 3], 'cour cheverny': [null, 6], 'valencay': [3, 3],
  // Beaujolais
  'beaujolais': [4, 3], 'beaujolais villages': [4, null], 'morgon': [8, null], 'moulin a vent': [10, null], 'chenas': [7, null], 'julienas': [6, null],
  'cote de brouilly': [6, null], 'brouilly': [4, null], 'fleurie': [5, null], 'chiroubles': [3, null], 'regnie': [4, null], 'saint amour': [5, null],
  // Alsace
  'alsace riesling': [null, 6], 'alsace pinot gris': [5, 5], 'alsace gewurztraminer': [null, 5], 'alsace pinot noir': [4, null], 'alsace pinot blanc': [null, 3],
  'alsace sylvaner': [null, 3], 'alsace muscat': [null, 3], 'alsace edelzwicker': [null, 3],
  // Sud-Ouest, Jura, Savoie
  'cahors': [8, null], 'madiran': [10, null], 'irouleguy': [6, 4], 'pecharmant': [7, null], 'bergerac': [4, 3], 'cotes de bergerac': [5, 3], 'gaillac': [4, 3],
  'fronton': [4, null], 'buzet': [5, null], 'marcillac': [4, null], 'saint mont': [5, 3], 'jurancon sec': [null, 5], 'pacherenc du vic bilh': [null, 6],
  'arbois': [5, 6], 'cotes du jura': [5, 5], 'l etoile': [null, 6], 'chateau chalon': [null, 25], 'vin de savoie': [3, 3], 'roussette de savoie': [null, 4], 'seyssel': [null, 4], 'bugey': [3, 3],
  // Languedoc-Roussillon
  'faugeres': [7, null], 'saint chinian': [6, null], 'minervois la liviniere': [8, null], 'minervois': [5, 3], 'corbieres': [5, 3], 'corbieres boutenac': [8, null],
  'fitou': [6, null], 'terrasses du larzac': [8, null], 'pic saint loup': [7, null], 'montpeyroux': [7, null], 'la clape': [7, 5], 'pezenas': [6, null],
  'languedoc': [4, 3], 'picpoul de pinet': [null, 2], 'limoux': [null, 5], 'collioure': [8, 4], 'cotes du roussillon': [5, 3], 'cotes du roussillon villages': [6, null],
  'tautavel': [7, null], 'maury': [12, 12], 'maury sec': [8, null], 'banyuls': [15, 15], 'banyuls grand cru': [20, 20], 'rivesaltes': [10, 10],
  // Provence et Corse
  'bandol': [10, 4], 'palette': [8, 6], 'cassis': [null, 3], 'bellet': [5, 4], 'coteaux d aix en provence': [4, 3], 'les baux de provence': [5, null],
  'cotes de provence': [3, 3], 'coteaux varois en provence': [3, 3], 'patrimonio': [6, 4], 'ajaccio': [5, 3], 'vin de corse': [4, 3],
};
// Nom d'appellation sans le niveau (« Chassagne-Montrachet Premier Cru » → « chassagne montrachet »).
const sansNiveau = nom => cleTexte(nom).replace(/ (premier cru|grand cru)$/, '');
// Niveau hiérarchique : grand cru > premier cru > village (ou appellation régionale). Le village n'est jamais un grand cru.
export function niveau(w) {
  const t = texteVin(w);
  if (PRESTIGE.test(t)) return 'grand';
  if (PREMIER_CRU.test(t)) return 'premier';
  return 'village';
}

// Repère de la table pour ce vin : { ans, fiab, min, max } ou null. Ne concerne ni les liquoreux ni le champagne (règles propres).
const COUL = { Rouge: 'R', Blanc: 'B', 'Rosé': 'S', 'Pétillant': 'P' };
export function refTable(w) {
  const app = w && w.region ? reconnaitre(String(w.region)) : null;
  const c = w && COUL[w.color];
  if (!app || !c) return null;
  const t = texteVin(w);
  if (LIQUOREUX.test(t) || /champagne/.test(t)) return null;
  const niv = (PRESTIGE.test(t) || /grand cru$/i.test(app[0])) && !/saint[- ]émilion|banyuls/i.test(app[0]) ? 'g' : (PREMIER_CRU.test(t) || /premier cru$/i.test(app[0])) ? 'p' : 'v';
  const e = TABLE_APOGEE[`${cleTexte(app[0]).replace(/ (premier cru|grand cru)$/, '')}|${niv}|${c}`];
  return e ? { ans: e[0], fiab: e[1], min: e[2], max: e[3] } : null;
}

// Qualité du millésime (note 1 à 5 de la bible) : un millésime faible atteint son pic plus tôt, un grand millésime plus tard.
// Les durées de référence (règles et table) valent pour un bon millésime (note 4) : c'est la référence neutre.
// L'écart est proportionnel à la durée de vie du vin (un grand vin de garde bouge de plusieurs années, un vin léger d'une seule).
const DECALAGE_PIC = { 1: -0.4, 2: -0.28, 3: -0.12, 4: 0, 5: 0.1 };
export const decalageQualite = (ans, q) => Math.round(ans * (DECALAGE_PIC[Number(q)] ?? 0));

// Calcule l'apogée d'un vin. annee = année en cours (pour le statut). qualite = note du millésime dans la bible (facultative).
// Renvoie { pic, from, to, statut, regle, ans, sansMillesime }.
export function apogee(w, annee = new Date().getFullYear(), qualite) {
  const texte = texteVin(w);
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
  const base = app ? (PAR_APPELLATION[cleTexte(app[0])] ?? PAR_APPELLATION[sansNiveau(app[0])]) : null;
  const nomApp = app ? app[0].replace(/ (Premier|Grand) Cru$/, '') : '';
  const enAns = (ans, label) => ({ ans, label });
  const ref = refTable(w);
  if (LIQUOREUX.test(texte)) r = REGLES.liquoreux;
  else if (ref && (ref.fiab === 'A' || ref.fiab === 'B') && !champagne) r = enAns(ref.ans, 'table de référence');
  else if (w.color === 'Pétillant' && champagne) r = REGLES.champagne;
  else if (PRESTIGE.test(texte) || (app && /grand cru$/i.test(app[0]) && !/saint[- ]émilion|banyuls/i.test(app[0]))) {
    // Grand cru : règle générale ; quelques régions vieillissent moins longtemps.
    r = /chablis|alsace/.test(texte) ? enAns(12, 'grand cru (Chablis, Alsace)') : REGLES.prestige;
  }
  else if (PREMIER_CRU.test(texte) || (app && /premier cru$/i.test(app[0]))) {
    r = w.color === 'Blanc' ? enAns(10, 'premier cru blanc') : REGLES.premierCru;
  }
  else if (w.color === 'Pétillant') r = REGLES.cremant;
  else if (w.color === 'Rosé') r = REGLES.rose;
  else if (base && (w.color === 'Rouge' || w.color === 'Blanc') && base[w.color === 'Rouge' ? 0 : 1] != null) {
    r = enAns(base[w.color === 'Rouge' ? 0 : 1], nomApp);
  }
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

  const L = largeur(r);
  const ansEff = Math.max(1, r.ans + decalageQualite(r.ans, qualite));
  let pic = millesime + ansEff;
  let from = pic - L.h; let to = pic + L.h;
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
  return { pic, from, to, statut, regle: r.label, ans: ansEff, ansRegle: r.ans, sansMillesime: false, ajuste, cat: L.cat, avant: L.avant, apres: L.apres };
}

// Largeur de la période d'apogée autour du pic, et marge de la fenêtre de dégustation avant et après (années).
// Plus un vin tient longtemps, plus la période d'apogée est large, mais jamais au point de couvrir une décennie entière.
// La fenêtre de dégustation (garde) contient toujours la période d'apogée, avec une marge avant et une marge après.
export function largeur(r) {
  const ans = r.ans;
  // La marge après l'apogée est proportionnelle à la durée de vie du vin : un grand vin de garde reste agréable bien après son pic.
  if (ans >= 20) return { cat: 'longue', h: 4, avant: 4, apres: 6 };
  if (ans >= 12) return { cat: 'prestige', h: 3, avant: 3, apres: Math.min(12, Math.round(ans * 0.8)) };
  if (ans >= 8) return { cat: 'structure', h: 2, avant: 2, apres: Math.round(ans * 0.9) };
  if (ans <= 3) return { cat: 'leger', h: 1, avant: 1, apres: 2 };
  return { cat: 'courant', h: 2, avant: 2, apres: ans >= 6 ? 4 : 3 };
}

// Fenêtre de dégustation proposée (garde) pour un vin : contient la période d'apogée. Sans millésime : null.
// La qualité du millésime (note 1 à 5 de la bible) décale le pic (voir apogee) et allonge ou raccourcit la fin de la fenêtre :
// 1 ou 2 : vin qui s'essouffle plus vite ; 4 ou 5 : vin qui tient plus longtemps. L'apogée elle-même n'est jamais coupée.
// L'effet est proportionnel à la durée de vie du vin (un grand vin de garde gagne ou perd plus d'années qu'un vin courant).
const FACTEUR_APRES = { 1: -0.55, 2: -0.45, 3: -0.2, 4: 0, 5: 0.15 };
export function fenetreGarde(w, qualite = 3) {
  const a = apogee({ ...w, from: null, to: null }, undefined, qualite);
  if (a.sansMillesime) return null;
  const debut = Math.max(Number(w.year) + 1, a.from - a.avant);
  const delta = Math.round(a.ansRegle * (FACTEUR_APRES[Number(qualite)] ?? 0));
  const apres = Math.max(0, a.apres + delta);
  const fin = a.to + apres;
  return { from: Math.min(debut, a.from), to: Math.max(fin, a.to) };
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
  const texte = texteVin(w);
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
