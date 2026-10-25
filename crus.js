// Rang du vin au sein de son appellation : niveau de cru en Bourgogne (village, premier cru, grand cru), classements de Bordeaux,
// grands crus d'Alsace, cuvées de prestige du Champagne et cuvées parcellaires célèbres. Pur : hors connexion, sans IA.
// Principe (voir data/METHODE-FENETRES.md) : durée au pic = durée de base de l'appellation × coefficient de rang.
// Les coefficients viennent de la connaissance de dégustation (Clive Coates pour la Bourgogne) : ce sont des estimations, pas des mesures.
import { norm } from './util.js';

// Texte comparable : minuscules, sans accents, tirets et apostrophes remplacés par des espaces.
export const cle = t => norm(t).replace(/[-'’]/g, ' ').replace(/\s+/g, ' ').trim();

/* ───────────────────────── Bourgogne et Chablis ───────────────────────── */

// Communes de Bourgogne (clé = nom d'appellation sans accents ni tirets) → nom d'affichage. Les plus longues d'abord pour la recherche dans un texte.
export const COMMUNES = {
  'gevrey chambertin': 'Gevrey-Chambertin', 'morey saint denis': 'Morey-Saint-Denis', 'chambolle musigny': 'Chambolle-Musigny', 'vosne romanee': 'Vosne-Romanée',
  'nuits saint georges': 'Nuits-Saint-Georges', 'pernand vergelesses': 'Pernand-Vergelesses', 'savigny les beaune': 'Savigny-lès-Beaune', 'chorey les beaune': 'Chorey-lès-Beaune',
  'chassagne montrachet': 'Chassagne-Montrachet', 'puligny montrachet': 'Puligny-Montrachet', 'auxey duresses': 'Auxey-Duresses', 'aloxe corton': 'Aloxe-Corton',
  'saint romain': 'Saint-Romain', 'saint aubin': 'Saint-Aubin', 'pouilly fuisse': 'Pouilly-Fuissé', 'pouilly loche': 'Pouilly-Loché', 'pouilly vinzelles': 'Pouilly-Vinzelles',
  'marsannay': 'Marsannay', 'fixin': 'Fixin', 'vougeot': 'Vougeot', 'ladoix': 'Ladoix', 'beaune': 'Beaune', 'pommard': 'Pommard', 'volnay': 'Volnay', 'monthelie': 'Monthélie',
  'meursault': 'Meursault', 'blagny': 'Blagny', 'santenay': 'Santenay', 'maranges': 'Maranges', 'mercurey': 'Mercurey', 'givry': 'Givry', 'rully': 'Rully', 'montagny': 'Montagny',
  'bouzeron': 'Bouzeron', 'saint veran': 'Saint-Véran', 'chablis': 'Chablis', 'irancy': 'Irancy', 'macon': 'Mâcon',
};
const ORDRE_COMMUNES = Object.keys(COMMUNES).sort((a, b) => b.length - a.length);
// Côte de Beaune : les blancs de 1996 à 2014 sont exposés à l'oxydation prématurée (« premox »).
export const COTE_DE_BEAUNE = new Set(['aloxe corton', 'pernand vergelesses', 'ladoix', 'savigny les beaune', 'chorey les beaune', 'beaune', 'pommard', 'volnay', 'monthelie', 'auxey duresses', 'saint romain', 'meursault', 'blagny', 'puligny montrachet', 'chassagne montrachet', 'saint aubin', 'santenay', 'maranges']);

// Un nom de village contient parfois le nom d'un grand cru sans en être un (« Gevrey-Chambertin », « Vosne-Romanée »…) : on le raccourcit avant de chercher.
const VILLAGES = [[/\bgevrey chambertin\b/g, 'gevrey'], [/\bchambolle musigny\b/g, 'chambolle'], [/\bvosne romanee\b/g, 'vosne'], [/\bflagey echezeaux\b/g, 'flagey'],
  [/\bpuligny montrachet\b/g, 'puligny'], [/\bchassagne montrachet\b/g, 'chassagne'], [/\baloxe corton\b/g, 'aloxe'], [/\bmorey saint denis\b/g, 'morey']];
const reduire = t => VILLAGES.reduce((s, [re, to]) => s.replace(re, to), t);

// Grands crus de Bourgogne et leur commune d'accueil. « tendre » : grand cru plus souple (coefficient intermédiaire).
const GRANDS_CRUS = [
  { re: /\bchambertin\b|\bclos de beze\b/, hote: 'gevrey chambertin' },
  { re: /\bclos de la roche\b|\bclos saint denis\b|\bclos des lambrays\b|\bclos de tart\b/, hote: 'morey saint denis' },
  { re: /\bbonnes mares\b|\bmusigny\b/, hote: 'chambolle musigny' },
  { re: /\bclos (de )?vougeot\b/, hote: 'vougeot', tendre: true },
  { re: /\bechezeaux\b|\bromanee\b|\brichebourg\b|\bla tache\b|\bla grande rue\b/, hote: 'vosne romanee' },
  { re: /\bcorton\b|\bcharlemagne\b/, hote: 'aloxe corton' },
  { re: /\bcriots\b/, hote: 'chassagne montrachet' },
  { re: /\bmontrachet\b/, hote: 'puligny montrachet' },
  { re: /\bchablis grand cru\b|\b(blanchot|bougros|grenouilles|preuses|valmur|vaudesir)\b/, hote: 'chablis' },
];
// Premiers crus qui se comportent comme des grands crus (climat + commune : le nom seul ne suffit pas, « Les Perrières » existe ailleurs).
const SUPER_PREMIERS = [
  { re: /\bclos saint jacques\b/, hote: 'gevrey chambertin' }, { re: /\bcros parantoux\b/, hote: 'vosne romanee' },
  { re: /\bamoureuses\b/, hote: 'chambolle musigny' }, { re: /\bperrieres\b/, hote: 'meursault' },
];
const FACTEUR = { village: 1, premier: 1.5, super: 2.2, grand: 2.2, tendre: 1.8 };
export const facteurBourgogne = n => FACTEUR[n.sup ? 'super' : n.tendre ? 'tendre' : n.niveau];

// Commune d'accueil : l'appellation reconnue d'abord, sinon un nom de commune dans le texte.
function hote(tBrut, app) {
  if (app && app[2] === 'Bourgogne') {
    const k = cle(app[0]).replace(/ (premier cru|grand cru)$/, '');
    if (COMMUNES[k]) return k;
  }
  const t = ' ' + tBrut + ' ';
  return ORDRE_COMMUNES.find(k => t.includes(' ' + k + ' ')) || null;
}
// Niveau d'un vin de Bourgogne ou de Chablis : { niveau: 'village'|'premier'|'grand', hote, tendre, sup }.
// Seuls la région et le nom comptent (le domaine peut s'appeler « Clos de Tart » et faire aussi du village).
export function niveauBourgogne(region, name, app) {
  const tBrut = cle(`${region || ''} | ${name || ''}`);
  const t = reduire(tBrut);
  const h = hote(tBrut, app);
  const gc = GRANDS_CRUS.find(g => g.re.test(t));
  if (gc) return { niveau: 'grand', hote: gc.hote, tendre: !!gc.tendre || /\bruchottes\b/.test(t), sup: false };
  const sup = SUPER_PREMIERS.find(s => s.re.test(t) && s.hote === h);
  if (/\b(1er|premier|1 er) cru\b/.test(t) || sup) return { niveau: 'premier', hote: h, tendre: false, sup: !!sup };
  return { niveau: 'village', hote: h, tendre: false, sup: false };
}

/* ───────────────────────── Bordeaux ───────────────────────── */

// Seconds vins et autres cuvées qui contiennent le nom d'un grand château sans en être le grand vin : pas de promotion.
const SECONDS_VINS = /forts de latour|pauillac de chateau latour|carruades|pavillon (rouge|blanc)|petit mouton|moulin de duhart|clos du marquis|sarget|dame de montrose|pagodes de cos|connetable|reserve de la comtesse|echo de lynch|la sirene|alter ego|margaux du chateau|lions de suduiraut|petit cheval|chapelle d ausone|clarence|bahans|carmes haut brion|chapelle de la mission|croix de beaucaillou|marquis de calon|petit lion|second vin|baron de brane|haut bages averous|tourelles de longueville|prelude a|diane de belgrave|les hauts de|fiefs de lagrange|pensees de lafleur|charmes de kirwan|tour figeac|carillon d angelus/;
// [coefficient, libellé, appellation (sur la région), noms (sur le nom et le domaine)]. Premier match gagne ; le coefficient s'applique à la durée de l'appellation.
const R1 = 1.85, R2 = 1.45, R3 = 1.1;
const CLASSES = [
  // Premiers crus classés 1855 et Graves
  [2.0, 'premier cru classé', /pessac|graves/, [/\bla mission haut brion\b/]],
  [1.35, 'cru classé de Graves', /pessac|graves/, [/\blaville haut brion\b/, /\bla tour haut brion\b/]],
  [2.0, 'premier cru classé', /pessac|graves/, [/(^| )haut brion\b/]],
  [R1, 'premier cru classé', /pauillac/, [/\blafite\b/, /\blatour\b/, /\bmouton rothschild\b/]],
  [R1, 'premier cru classé', /margaux/, [/\bchateau margaux\b/]],
  // Deuxièmes crus
  [R2, 'deuxième cru classé', /margaux/, [/\brauzan\b/, /\bdurfort vivens\b/, /\blascombes\b/, /\bbrane cantenac\b/]],
  [R2, 'deuxième cru classé', /saint julien/, [/\bleoville\b/, /\bgruaud larose\b/, /\bducru beaucaillou\b/]],
  [R2, 'deuxième cru classé', /pauillac/, [/\bpichon\b/]],
  [R2, 'deuxième cru classé', /saint estephe/, [/\bcos d estournel\b/, /\bmontrose\b/]],
  // Troisièmes à cinquièmes crus
  [R3, 'cru classé (3e à 5e)', /margaux/, [/\bkirwan\b/, /\bd issan\b/, /\bgiscours\b/, /\bmalescot\b/, /\bboyd cantenac\b/, /\bcantenac brown\b/, /\bpalmer\b/, /\bdesmirail\b/, /\bferriere\b/, /\bmarquis d alesme\b/,
    /\bpouget\b/, /\bprieure lichine\b/, /\bmarquis de terme\b/, /\bdauzac\b/, /\bdu tertre\b/]],
  [R3, 'cru classé (3e à 5e)', /saint julien/, [/\blagrange\b/, /\blangoa\b/, /\bsaint pierre\b/, /\btalbot\b/, /\bbranaire\b/, /\bbeychevelle\b/]],
  [R3, 'cru classé (3e à 5e)', /saint estephe/, [/\bcalon segur\b/, /\blafon rochet\b/, /\bcos labory\b/]],
  [R3, 'cru classé (3e à 5e)', /pauillac/, [/\bduhart milon\b/, /\bpontet canet\b/, /\bbatailley\b/, /\bgrand puy\b/, /\blynch bages\b/, /\blynch moussas\b/, /\bd armailhac\b/, /\bhaut bages liberal\b/, /\bpedesclaux\b/, /\bclerc milon\b/, /\bcroizet bages\b/]],
  [R3, 'cru classé (3e à 5e)', /haut medoc/, [/\bla lagune\b/, /\bla tour carnet\b/, /\bbelgrave\b/, /\bcamensac\b/, /\bcantemerle\b/]],
  // Graves et Pessac-Léognan (classement de 1959)
  [1.15, 'cru classé de Graves', /pessac|graves/, [/\bbouscaut\b/, /\bhaut bailly\b/, /\bcarbonnieux\b/, /\bdomaine de chevalier\b/, /\bfieuzal\b/, /(^| )olivier\b/, /\bmalartic lagraviere\b/, /\bla tour martillac\b/, /\bsmith haut lafitte\b/, /\bpape clement\b/, /\bcouhins\b/]],
  // Saint-Émilion
  [2.0, 'premier grand cru classé A', /saint emilion/, [/\bausone\b/, /\bcheval blanc\b/, /\bangelus\b/, /\bpavie\b(?! macquin| decesse)/, /\bfigeac\b/]],
  [1.55, 'premier grand cru classé B', /saint emilion/, [/\bbeau sejour becot\b/, /\bbeausejour\b/, /\bbelair monange\b/, /\bcanon\b/, /\blarcis ducasse\b/, /\bpavie macquin\b/, /\btroplong mondot\b/, /\btrottevieille\b/, /\bvalandraud\b/, /\bclos fourtet\b/, /\bla mondotte\b/]],
  // Pomerol (pas de classement officiel : grands noms reconnus)
  [1.5, 'grand pomerol', /^pomerol\b/, [/\blafleur\b/, /\bl evangile\b/, /\bvieux chateau certan\b/, /\btrotanoy\b/, /\bla conseillante\b/, /\bcertan de may\b/, /\bclinet\b/, /\blatour a pomerol\b/, /\bgazin\b/, /\bhosanna\b/, /\bla fleur petrus\b/]],
  [2.0, 'grand pomerol', /^pomerol\b/, [/\bpetrus\b/, /\ble pin\b/]],
  // Sauternes et Barsac (classement de 1855)
  [1.5, 'premier cru supérieur', /sauternes/, [/\byquem\b/]],
  [1.15, 'premier cru classé', /sauternes|barsac/, [/\bla tour blanche\b/, /\blafaurie peyraguey\b/, /\bclos haut peyraguey\b/, /\brayne vigneau\b/, /\bsuduiraut\b/, /\bcoutet\b/, /\bclimens\b/, /\bguiraud\b/, /\brieussec\b/, /\brabaud promis\b/, /\bsigalas rabaud\b/]],
];
// Blancs de Pessac-Léognan : les très grands blancs vieillissent bien plus que le blanc courant de l'appellation (Domaine de Chevalier blanc 2015 : fenêtres de 2020 à 2035 chez les critiques).
const GRANDS_BLANCS_GRAVES = [/(^| )haut brion\b/, /\blaville haut brion\b/, /\bdomaine de chevalier\b/, /\bla mission haut brion\b/];

// Rang d'un vin de Bordeaux : { f, libelle, min } ou null. `min` : durée minimale au pic pour un cru classé de petite appellation.
export function rangBordeaux(name, dom, region, color) {
  const tn = cle(`${name || ''} | ${dom || ''}`);
  if (SECONDS_VINS.test(tn)) return null;
  const tr = cle(region);
  if (!tr) return null;
  if (color === 'Blanc' && /pessac|graves/.test(tr) && GRANDS_BLANCS_GRAVES.some(re => re.test(tn))) return { f: 2, libelle: 'grand blanc de Pessac-Léognan', min: 0 };
  const hit = CLASSES.find(([, , app, noms]) => app.test(tr) && noms.some(re => re.test(tn)));
  if (!hit) return /saint emilion/.test(tr) && /grand cru classe/.test(cle(`${region} ${name}`)) ? { f: 1.2, libelle: 'grand cru classé', min: 0 } : null;
  return { f: hit[0], libelle: hit[1], min: hit[0] === R3 ? 13 : 0 };
}

/* ───────────────────────── Alsace ───────────────────────── */

const GRANDS_CRUS_ALSACE = /\b(altenberg de (bergheim|bergbieten|wolxheim)|brand|bruderthal|eichberg|engelberg|florimont|frankstein|furstentum|geisberg|gloeckelberg|goldert|hatschbourg|hengst|kaefferkopf|kanzlerberg|kessler|kirchberg de (barr|ribeauville)|kitterle|mambourg|mandelberg|marckrain|moenchberg|muenchberg|ollwiller|osterberg|pfersigberg|pfingstberg|praelatenberg|rangen|rosacker|saering|schlossberg|schoenenbourg|sommerberg|sonnenglanz|spiegel|sporen|steinert|steingrubler|steinklotz|vorbourg|wiebelsberg|wineck schlossberg|winzenberg|zinnkoepfle|zotzenberg)\b/;
// Niveau d'un vin d'Alsace : 'grand' (grand cru), 'lieu-dit', ou null.
export function niveauAlsace(region, name) {
  const t = cle(`${region || ''} | ${name || ''}`);
  if (/\bgrands? crus?\b/.test(t) || GRANDS_CRUS_ALSACE.test(t)) return 'grand';
  if (/\blieux? dits?\b/.test(t)) return 'lieu-dit';
  return null;
}

/* ───────────────────────── Champagne ───────────────────────── */

const PRESTIGE_CHAMPAGNE = /\bdom perignon\b|\bcristal\b|\bsalon\b|\bcomtes de champagne\b|\bla grande dame\b|\bbelle epoque\b|\bwinston churchill\b|\bclos des goisses\b|\bclos du mesnil\b|\bclos d ambonnay\b|\bkrug\b(?! grande cuvee)|\bdom ruinart\b|\bvieilles vignes francaises\b|\bcuvee louise\b|\bgrande annee\b|\bamour de deutz\b|\bcuvee de prestige\b|\br d\b/;
export const prestigeChampagne = (name, dom) => PRESTIGE_CHAMPAGNE.test(cle(`${name || ''} | ${dom || ''}`));

/* ───────────────────────── Cuvées parcellaires célèbres ───────────────────────── */

// [années au pic pour un bon millésime, libellé, appellation (sur la région, ou null), noms (sur le nom et le domaine)]
// Une cuvée célèbre vieillit plus que l'appellation : la valeur n'est retenue que si elle dépasse la durée de l'appellation.
const CUVEES = [
  [20, 'cuvée parcellaire (Côte-Rôtie)', /cote rotie/, [/\bla mouline\b/, /\bla landonne\b/, /\bla turque\b/]],
  [20, 'cuvée parcellaire (Hermitage)', /hermitage|ermitage/, [/\bla chapelle\b/, /\ble pavillon\b/, /\bl ermite\b/, /\bcathelin\b/]],
  [22, 'cuvée mythique (Châteauneuf-du-Pape)', /chateauneuf/, [/\brayas\b/]],
  [18, 'cuvée de prestige (Châteauneuf-du-Pape)', /chateauneuf/, [/\bhommage a jacques perrin\b/, /\bda capo\b/, /\bcuvee capo\b/, /\bcelestins\b/]],
  [16, 'cuvée parcellaire (Bandol)', /bandol/, [/\bcabassaou\b/, /\bla migoua\b/, /\bla tourtine\b/]],
  [14, 'domaine de référence (Alpilles)', null, [/\btrevallon\b/]],
  [14, 'domaine de référence (Saumur-Champigny)', /saumur/, [/\bclos rougeard\b/]],
  [15, 'domaine de référence (Languedoc)', null, [/\bmas de daumas gassac\b/, /\bgrange des peres\b/, /\bpeyre rose\b/]],
];
// Années au pic d'une cuvée célèbre, ou null.
export function cuveeCelebre(name, dom, region) {
  const tn = cle(`${name || ''} | ${dom || ''}`); const tr = cle(region);
  const hit = CUVEES.find(([, , app, noms]) => (!app || app.test(tr)) && noms.some(re => re.test(tn)));
  return hit ? { ans: hit[0], libelle: hit[1] } : null;
}
