// Apogée : période optimale de consommation estimée à partir du millésime, de la couleur, de la région et de l'appellation.
// Règle du sommelier de l'appli (brouillon de l'utilisateur), complétée par l'expérience. Pure : hors connexion, sans IA.
import { norm } from './util.js';
import { reconnaitre, reperage, estEtranger } from './chiffres.js';
import { profil } from './profils.js';
import { TABLE_APOGEE } from './apogee-table.js';
import { cle, niveauBourgogne, facteurBourgogne, COMMUNES, COTE_DE_BEAUNE, rangBordeaux, niveauAlsace, prestigeChampagne, cuveeCelebre, domaineReference, GROUPES_DOMAINE } from './crus.js';

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
// Appellations de vins doux que LIQUOREUX ne reconnaît pas (leur durée vient de PAR_APPELLATION) : le début de leur garde suit la règle des vins doux.
const DOUX_NOMS = /\b(saussignac|loupiac|sainte croix du mont|cerons|premieres cotes de bordeaux|graves superieures|muscat de (rivesaltes|beaumes de venise|frontignan|lunel|mireval)|muscat du cap corse|rivesaltes|maury(?! sec)|banyuls)\b|\bcadillac\b(?! cotes)/;
const PREMIER_CRU = /premier cru|1er cru/;
const PRESTIGE = /grand cru|grands crus|barolo|barbaresco|brunello|gran reserva|chateau (margaux|latour|lafite|mouton|haut brion|petrus|cheval blanc|ausone|angelus)|mouton rothschild|montrachet|romanee|chambertin|musigny|echezeaux|richebourg/;
const VIN_LEGER = /\bigp\b|indication geographique|pays d.oc|vin de france|\bvdf\b|vin de pays|vin de table/;

const ANNEE_MIN = 1900; const ANNEE_MAX = 2035;

// Un village n'est pas un grand cru : « Chassagne-Montrachet », « Gevrey-Chambertin », « Chambolle-Musigny », « Vosne-Romanée », « Puligny-Montrachet »,
// « Crozes-Hermitage » et « Saint-Émilion Grand Cru » contiennent le nom d'un grand cru ou d'un terme de prestige sans en être un.
const VILLAGES = /\b(chassagne|puligny|gevrey|chambolle|vosne|crozes) (montrachet|chambertin|musigny|romanee|hermitage)\b/g;
const cleTexte = cle;
export function texteVin(w) {
  return cleTexte([w.name, w.dom, w.grape, w.region].join(' | ')).replace(VILLAGES, '$1').replace(/saint emilion grand cru/g, 'saint emilion');
}

// Règle propre à chaque appellation (années après le millésime) : [rouge, blanc], null = non concerné.
// Valable pour le niveau « village » ou le vin de l'appellation ; 1er cru et grand cru ont leurs propres règles (voir niveau).
const PAR_APPELLATION = {
  // Bourgogne
  'bourgogne': [5, 4], 'bourgogne aligote': [null, 3], 'bourgogne hautes cotes de nuits': [6, 5], 'hautes cotes de nuits': [6, 5], 'hautes cotes de beaune': [6, 5],
  'marsannay': [6, 4], 'fixin': [8, 6], 'gevrey chambertin': [9, null], 'morey saint denis': [9, 8], 'chambolle musigny': [8, null], 'vosne romanee': [10, null],
  'nuits saint georges': [9, 6], 'vougeot': [8, 6], 'ladoix': [7, 6], 'chorey les beaune': [6, 5], 'aloxe corton': [9, 7], 'pernand vergelesses': [7, 6], 'savigny les beaune': [7, 5], 'beaune': [8, 6], 'pommard': [10, null],
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
  // Vins doux (durée du vin doux de l'appellation)
  'saussignac': [null, 12], 'premieres cotes de bordeaux': [null, 10], 'graves superieures': [null, 8], 'muscat du cap corse': [null, 6], 'muscat de rivesaltes': [null, 4], 'muscat de beaumes de venise': [null, 4],
  // Provence et Corse
  'bandol': [8, 4], 'palette': [8, 6], 'cassis': [null, 3], 'bellet': [5, 4], 'coteaux d aix en provence': [4, 3], 'les baux de provence': [5, null],
  'cotes de provence': [3, 3], 'coteaux varois en provence': [3, 3], 'patrimonio': [6, 4], 'ajaccio': [5, 3], 'vin de corse': [4, 3],
};
// Nom d'appellation sans le niveau (« Chassagne-Montrachet Premier Cru » → « chassagne montrachet »).
const sansNiveau = nom => cleTexte(nom).replace(/ (premier cru|grand cru)$/, '');
// Niveau hiérarchique : grand cru > premier cru > village (ou appellation régionale). Le village n'est jamais un grand cru.
// En Bourgogne et à Chablis, le niveau vient de crus.js (grands crus nommés, mention « 1er cru », super premiers crus).
export function niveau(w) {
  const app = w && w.region ? reconnaitre(String(w.region)) : null;
  if (app && app[2] === 'Bourgogne') return niveauBourgogne(w.region, w.name, app).niveau;
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
// Amplitude : grand millésime +25 %, millésime faible −25 % (Clive Coates pour la Bourgogne), appliquée à toutes les régions.
// L'écart est proportionnel à la durée de vie du vin (un grand vin de garde bouge de plusieurs années, un vin léger d'une seule).
const DECALAGE_PIC = { 1: -0.4, 2: -0.25, 3: -0.1, 4: 0, 5: 0.25 };
export const decalageQualite = (ans, q) => Math.round(ans * (DECALAGE_PIC[Number(q)] ?? 0));

// Vins de très longue garde dont la fenêtre ne se déduit pas d'un pic entouré d'une marge (années après la récolte, bon millésime).
// Vin jaune : début fixe à 10 ans (élevage de 6 ans et 3 mois sous voile, puis stabilisation), fin de 30 à 50 ans et plus.
// Grands liquoreux de la Loire (Quarts-de-Chaume, Bonnezeaux) : garde de 20 à 60 ans et plus.
const VIN_JAUNE = /vin jaune|chateau chalon/;
const GRAND_LIQUOREUX_LOIRE = /quarts? de chaume|bonnezeaux/;
const VT_SGN = /grains nobles|\bsgn\b|vendanges? tardives?|\bvt\b/;
const FORMES_LONGUES = {
  jaune: { pic: 25, debut: 10, fin: 40, gdebut: 8, gfin: 50, libelle: 'vin jaune' },
  liqLoire: { pic: 30, debut: 20, fin: 45, gdebut: 15, gfin: 60, libelle: 'grand liquoreux de Loire' },
};

// Cépage d'un vin d'Alsace (clé de PAR_APPELLATION), pour fixer la durée de base d'un grand cru ou d'un lieu-dit. Inconnu : riesling.
const CEPAGES_ALSACE = [[/gewurztraminer/, 'alsace gewurztraminer'], [/pinot gris|tokay/, 'alsace pinot gris'], [/muscat/, 'alsace muscat'], [/sylvaner/, 'alsace sylvaner'], [/pinot noir/, 'alsace pinot noir'], [/pinot blanc|auxerrois/, 'alsace pinot blanc'], [/riesling/, 'alsace riesling']];
const cepageAlsace = texte => (CEPAGES_ALSACE.find(([re]) => re.test(texte)) || [0, 'alsace riesling'])[1];

// Durée de base (années au pic, bon millésime) d'un vin de Bourgogne ou de Chablis au niveau « village » de sa commune.
function baseBourgogne(w, app, n) {
  const idx = w.color === 'Rouge' ? 0 : 1, col = w.color === 'Rouge' ? 'R' : 'B';
  if (n.niveau === 'village') {
    const ref = refTable({ region: w.region, color: w.color });
    if (ref && (ref.fiab === 'A' || ref.fiab === 'B')) return ref.ans;
  } else if (n.hote) {
    const t = TABLE_APOGEE[`${n.hote}|v|${col}`];
    if (t && (t[1] === 'A' || t[1] === 'B')) return t[0];
  }
  const cherche = k => (k && PAR_APPELLATION[k] && PAR_APPELLATION[k][idx] != null ? PAR_APPELLATION[k][idx] : null);
  const k = app ? sansNiveau(app[0]) : '';
  const v = cherche(n.hote) ?? cherche(k) ?? (/^bourgogne/.test(k) ? cherche('bourgogne') : null);
  if (v != null) return v;
  return idx === 0 ? REGLES.rougeStructure.ans : (!app || /^bourgogne/.test(norm(app[0])) ? REGLES.blancBourgogneRegional.ans : REGLES.blancBourgogne.ans);
}

// Calcule l'apogée d'un vin. annee = année en cours (pour le statut). qualite = note du millésime dans la bible (facultative).
// Principe : durée au pic = durée de base de l'appellation × coefficient de rang (niveau de cru, classement, cuvée) × note du millésime (voir crus.js).
// Renvoie { pic, from, to, statut, regle, ans, sansMillesime, rang, forme, gFrom, gTo }.
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

  let r; let forme = 'standard'; let rang = false; let cuveeRetenue = false; let premox = false; let fixe = null; let nivB = null;
  const rouge = w.color === 'Rouge', blanc = w.color === 'Blanc';
  const base = app ? (PAR_APPELLATION[cleTexte(app[0])] ?? PAR_APPELLATION[sansNiveau(app[0])]) : null;
  const nomApp = app ? app[0].replace(/ (Premier|Grand) Cru$/, '') : '';
  const enAns = (ans, label) => ({ ans, label });
  const ref = refTable(w);
  const bordeaux = (rouge || blanc) ? rangBordeaux(w.name, w.dom, w.region, w.color) : null;
  const nivAlsace = grande === 'Alsace' && (rouge || blanc) && !LIQUOREUX.test(texte) ? niveauAlsace(w.region, w.name) : null;
  if (grande === 'Bourgogne' && (rouge || blanc) && !champagne) {
    // Bourgogne et Chablis : village × 1, premier cru × 1,5, grand cru × 2,2 (super premiers crus : comme un grand cru, grands crus plus souples × 1,8).
    const n = niveauBourgogne(w.region, w.name, app);
    const f = facteurBourgogne(n);
    r = enAns(Math.max(1, Math.round(baseBourgogne(w, app, n) * f)), n.niveau === 'village' ? nomApp
      : `${n.niveau === 'grand' ? 'grand cru' : 'premier cru'}${n.sup ? ' d’exception' : ''}${n.hote ? ` (${COMMUNES[n.hote]})` : ''}`);
    forme = 'bourgogne'; rang = n.niveau !== 'village'; nivB = n;
    premox = blanc && !!n.hote && COTE_DE_BEAUNE.has(n.hote) && millesime >= 1996 && millesime <= 2014;
  }
  else if (blanc && (VIN_JAUNE.test(texte) || GRAND_LIQUOREUX_LOIRE.test(texte))) {
    // Vins de très longue garde à fenêtre propre : vin jaune du Jura, grands liquoreux de la Loire.
    fixe = VIN_JAUNE.test(texte) ? FORMES_LONGUES.jaune : FORMES_LONGUES.liqLoire;
    r = enAns(fixe.pic, fixe.libelle); forme = 'longue'; rang = true;
  }
  else if (bordeaux) {
    // Classement du château : coefficient sur la durée de l'appellation (liquoreux : sur la durée des liquoreux).
    const idx = rouge ? 0 : 1;
    const pBase = LIQUOREUX.test(texte) ? REGLES.liquoreux.ans : (base && base[idx] != null ? base[idx] : (rouge ? REGLES.rougeStructure.ans : REGLES.blancSec.ans));
    r = enAns(Math.max(bordeaux.min, Math.round(pBase * bordeaux.f)), bordeaux.libelle); rang = true;
  }
  else if (grande === 'Alsace' && (rouge || blanc) && VT_SGN.test(texte)) {
    // Vendanges tardives ×2 et sélection de grains nobles ×3,5 sur la durée du cépage.
    const sgn = /grains nobles|\bsgn\b/.test(texte);
    const b = PAR_APPELLATION[cepageAlsace(texte)];
    const bp = (b && (b[rouge ? 0 : 1] ?? b[rouge ? 1 : 0])) ?? 6;
    r = enAns(Math.round(bp * (sgn ? 3.5 : 2)), sgn ? 'sélection de grains nobles (Alsace)' : 'vendanges tardives (Alsace)'); rang = true;
  }
  else if (LIQUOREUX.test(texte)) r = REGLES.liquoreux;
  else if (ref && (ref.fiab === 'A' || ref.fiab === 'B') && !champagne) r = enAns(ref.ans, 'table de référence');
  else if (w.color === 'Pétillant' && champagne) {
    if (prestigeChampagne(w.name, w.dom)) { r = enAns(Math.round(REGLES.champagne.ans * 1.8), 'cuvée de prestige (champagne)'); rang = true; }
    else r = /blanc de blancs/.test(texte) ? enAns(Math.round(REGLES.champagne.ans * 1.2), 'champagne blanc de blancs millésimé') : REGLES.champagne;
  }
  else if (nivAlsace) {
    const b = PAR_APPELLATION[cepageAlsace(texte)];
    const bp = (b && (b[rouge ? 0 : 1] ?? b[rouge ? 1 : 0])) ?? 6;
    r = enAns(Math.round(bp * (nivAlsace === 'grand' ? 2 : 1.4)), nivAlsace === 'grand' ? 'grand cru d’Alsace' : 'lieu-dit d’Alsace'); rang = true;
  }
  else if (grande === 'Alsace' && (rouge || blanc)) {
    // Alsace AOC sans grand cru ni lieu-dit : durée propre au cépage (la taxonomie range « Alsace » sous « Alsace Grand Cru », d'où ce cas à part).
    const b = PAR_APPELLATION[cepageAlsace(texte)];
    r = enAns((b && (b[rouge ? 0 : 1] ?? b[rouge ? 1 : 0])) ?? 5, 'Alsace');
  }
  else if (PRESTIGE.test(texte) || (app && /grand cru$/i.test(app[0]) && !/saint[- ]émilion|banyuls/i.test(app[0]))) {
    // Grand cru hors Bourgogne et Alsace (Barolo, Brunello…) : règle générale.
    r = REGLES.prestige; rang = true;
  }
  else if (PREMIER_CRU.test(texte) || (app && /premier cru$/i.test(app[0]))) {
    r = w.color === 'Blanc' ? enAns(10, 'premier cru blanc') : REGLES.premierCru; rang = true;
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
    r = REGLES.blancSec;
  }
  else r = REGLES.autre;
  // Cuvée parcellaire ou domaine de référence : plus de garde que l'appellation, jamais moins.
  if (forme === 'standard' && (rouge || blanc)) {
    const cv = cuveeCelebre(w.name, w.dom, w.region);
    if (cv && cv.ans > r.ans) { r = enAns(cv.ans, cv.libelle); rang = true; cuveeRetenue = true; }
  }
  // Domaine de référence (Bourgogne, Loire, Rhône, Alsace, Jura, Sud) : durée au pic × (1 + moitié de l'écart du coefficient). Pas de cumul avec une cuvée célèbre déjà retenue,
  // ni pour Bordeaux et le champagne (le classement ou la cuvée disent déjà le rang), ni pour les fenêtres fixes (vin jaune, grands liquoreux de la Loire).
  let domaine = null;
  if ((rouge || blanc) && !fixe && !champagne && !bordeaux && !cuveeRetenue && GROUPES_DOMAINE.includes(grande)) {
    domaine = domaineReference(w.name, w.dom);
    if (domaine) { r = enAns(Math.max(r.ans, Math.round(r.ans * domaine.f)), `${r.label}, domaine ${domaine.nom}`); rang = true; }
  }

  const ansEff = Math.max(1, r.ans + decalageQualite(r.ans, qualite));
  const pic0 = millesime + ansEff;
  let pic = pic0; let from; let to; let gFrom = null; let gTo = null; let L;
  if (forme === 'bourgogne') {
    // Forme propre à la Bourgogne : apogée de 0,8 à 1,2 fois la durée au pic ; garde (fenêtre de dégustation) calée sur les repères de Clive Coates.
    // Rouges : de 0,5 à 1,4 fois le pic. Blancs : un vin de village ou de premier cru se boit dès 3 ans (début à 0,3 fois le pic, 0,45 pour un grand cru),
    // et la fin tombe à 1,25 fois le pic (Coates : village blanc 3-8 ans, premier cru 5-13, grand cru 8-18).
    const k = x => Math.round(ansEff * x);
    from = millesime + k(0.8); to = millesime + k(1.2);
    const debut = blanc ? (nivB.niveau === 'grand' ? 0.45 : 0.3) : 0.5;
    gFrom = millesime + Math.max(blanc && nivB.niveau !== 'grand' ? (nivB.hote ? 3 : 2) : 1, k(debut)); gTo = millesime + k(blanc ? 1.25 : 1.4);
    // Blancs de la Côte de Beaune 1996-2014 : oxydation prématurée possible, fin d'apogée raccourcie de 20 %, fin de garde de 15 %.
    if (premox) { to = Math.max(pic, millesime + Math.round((to - millesime) * 0.8)); gTo = millesime + Math.round((gTo - millesime) * 0.85); }
    from = Math.min(from, pic); to = Math.max(to, pic); gFrom = Math.min(gFrom, from); gTo = Math.max(gTo, to);
    L = { cat: 'bourgogne', avant: from - gFrom, apres: gTo - to };
  } else if (forme === 'longue') {
    // Fenêtre propre : début fixe (élevage et stabilisation), fin allongée ou raccourcie par la note du millésime.
    const d = Math.min(1.1, 1 + (DECALAGE_PIC[Number(qualite)] ?? 0)); // un grand millésime prolonge peu une fenêtre déjà très longue
    from = Math.min(millesime + fixe.debut, pic); to = Math.max(millesime + Math.round(fixe.fin * d), pic);
    gFrom = Math.min(millesime + fixe.gdebut, from); gTo = Math.max(millesime + Math.round(fixe.gfin * d), to);
    L = { cat: 'longue-fixe', avant: from - gFrom, apres: gTo - to };
  } else {
    const doux = LIQUOREUX.test(texte) || DOUX_NOMS.test(texte);
    const court = rouge && REGIONS_COURTES.includes(grande);
    L = largeur(r, { blanc: blanc && !doux, doux, court });
    from = pic - L.h; to = pic + L.h;
    // Fenêtre de dégustation (garde). Début : une part de la durée au pic (la moitié pour les rouges, 0,4 pour les blancs secs, un tiers pour les vins doux, 0,55 pour les
    // champagnes), jamais plus tard que la marge avant l'apogée ; un grand millésime ne retarde pas le début ; un rouge hors Bourgogne n'est jamais attendu plus de
    // 10 ans (les critiques ouvrent la fenêtre des premiers crus classés 7 à 10 ans après la récolte). Repères : fenêtres publiées par Vinous, Decanter,
    // Wine Advocate, Jancis Robinson et Burghound (voir tests/unit.mjs). Fin : apogée + marge après ; un grand millésime n'allonge la fin que de 10 % de la durée au pic.
    const ks = doux ? 0.33 : w.color === 'Pétillant' ? 0.55 : blanc ? 0.4 : 0.5;
    const ansDebut = Math.min(ansEff, r.ans);
    const debut = Math.round(ks * ansDebut);
    gFrom = millesime + Math.max(1, Math.min(ansEff - L.h - L.avant, rouge && !doux ? Math.min(DEBUT_MAX_ROUGE, debut) : debut));
    const ecart = ansEff - r.ans;
    const ansFin = ecart > 0 ? r.ans + Math.min(ecart, Math.round(0.1 * r.ans)) : ansEff;
    const delta = ecart < 0 ? Math.round(r.ans * (FACTEUR_APRES[Number(qualite)] ?? 0)) : 0;
    gTo = millesime + ansFin + L.h + Math.max(0, L.apres + delta);
    gFrom = Math.min(gFrom, from); gTo = Math.max(gTo, to);
  }
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
  return { pic, from, to, statut, regle: r.label, ans: ansEff, ansRegle: r.ans, sansMillesime: false, ajuste, cat: L.cat, avant: L.avant, apres: L.apres, rang, forme, gFrom, gTo, domaine: domaine ? domaine.nom : null };
}

// Largeur de la période d'apogée autour du pic, et marge de la fenêtre de dégustation avant et après (années).
// Plus un vin tient longtemps, plus la période d'apogée est large, mais jamais au point de couvrir une décennie entière.
// La fenêtre de dégustation (garde) contient toujours la période d'apogée, avec une marge avant et une marge après.
// Rouges du Rhône, de Provence et du Sud-Ouest : les critiques ferment la fenêtre environ un tiers plus près du pic qu'à Bordeaux
// (Cornas 2018 : 14-17 ans, Châteauneuf 2012 : 15-17, Gigondas 2018 : 12-15, Bandol 2016 : 14, Hermitage La Chapelle 2015 : 20-25, Cahors 2014 : 14).
const REGIONS_COURTES = ['Vallée du Rhône', 'Provence et Corse', 'Sud-Ouest, Jura, Savoie'];
const COEF_COURT = 0.65;
const DEBUT_MAX_ROUGE = 10;
export function largeur(r, { blanc = false, doux = false, court = false } = {}) {
  const ans = r.ans;
  const cf = court ? COEF_COURT : 1;
  // La marge après l'apogée est proportionnelle à la durée de vie du vin : un grand vin de garde reste agréable bien après son pic.
  // Vins doux de longue garde : marge de 0,35 fois la durée au pic (Sauternes : fenêtres de 25 à 45 ans chez les critiques). Blancs secs de prestige : 0,5 fois (rouges : 0,8).
  if (doux && ans >= 20) return { cat: 'longue', h: 4, avant: 4, apres: Math.min(12, Math.round(ans * 0.35)) };
  if (ans >= 22) return { cat: 'longue', h: 4, avant: 4, apres: Math.round(cf * Math.min(14, Math.round(ans * 0.55))) }; // premiers crus classés, grands liquoreux
  if (ans >= 20) return { cat: 'longue', h: 4, avant: 4, apres: Math.round(cf * 6) };
  if (ans >= 12) return { cat: 'prestige', h: 3, avant: 3, apres: Math.round(cf * Math.min(12, Math.round(ans * (blanc ? 0.5 : 0.8)))) };
  if (ans >= 8) return { cat: 'structure', h: 2, avant: 2, apres: Math.round(cf * ans * 0.9) };
  if (ans <= 3) return { cat: 'leger', h: 1, avant: 1, apres: 2 };
  return { cat: 'courant', h: 2, avant: 2, apres: ans >= 6 ? 4 : 3 };
}

// Fenêtre de dégustation proposée (garde) pour un vin : contient la période d'apogée. Sans millésime : null.
// La qualité du millésime (note 1 à 5 de la bible) décale le pic (voir apogee) et raccourcit la fin de la fenêtre pour les notes 1 à 3 (vin qui s'essouffle plus vite).
// Un grand millésime (note 5) retarde le pic mais n'allonge la fin que de 10 % de la durée au pic et ne retarde pas le début. L'apogée elle-même n'est jamais coupée.
// L'effet est proportionnel à la durée de vie du vin (un grand vin de garde gagne ou perd plus d'années qu'un vin courant).
const FACTEUR_APRES = { 1: -0.55, 2: -0.45, 3: -0.2, 4: 0, 5: 0 };
export function fenetreGarde(w, qualite) {
  const a = apogee({ ...w, from: null, to: null }, undefined, qualite);
  if (a.sansMillesime) return null;
  return { from: a.gFrom, to: a.gTo };
}

// Fenêtre de garde d'un vin dont le rang (premier ou grand cru de Bourgogne, classement de Bordeaux, cuvée célèbre, prestige, grand cru d'Alsace) dépasse
// celui de sa ligne dans la bible ; null pour les autres, que la ligne de la bible décrit déjà. Sert à la fiche (origine « calc »).
export function fenetreRang(w, qualite) {
  const a = apogee({ ...w, from: null, to: null }, undefined, qualite);
  return a.rang && !a.sansMillesime ? fenetreGarde(w, qualite) : null;
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
  const nv = niveau(w);
  if (nv === 'grand') return rouge ? r(16, 18) : r(11, 13);
  if (nv === 'premier') return rouge ? r(16, 18) : r(10, 12);
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
