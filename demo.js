// Cave de démonstration : 15 bouteilles fictives (domaines inventés, appellations réelles) pour essayer l’appli
// sans rien saisir. Identifiants préfixés « demo- » : c’est ce qui permet de les retirer d’un geste, sans toucher à vos vins.
export const DEMO_PREFIX = 'demo-';
export const isDemo = w => !!w && String(w.id || '').startsWith(DEMO_PREFIX);

// [nom, domaine, âge du millésime (null = sans millésime), couleur, appellation, cépages, quantité, prix, début (âge), fin (âge), histoire, accords]
const LISTE = [
  ['Clos des Vignes Hautes', 'Domaine Exemple', 9, 'Rouge', 'Pomerol', 'Merlot, Cabernet franc', 3, 45, 8, 18, 'Un pomerol de plateau argilo-graveleux, rond et soyeux, qui s’ouvre après huit à dix ans.', ['Agneau rôti', 'Côte de bœuf', 'Magret de canard', 'Fromages affinés']],
  ['Les Pierres Blanches', 'Château Démo', 14, 'Rouge', 'Margaux', 'Cabernet sauvignon, Merlot', 2, 62, 10, 16, 'Un margaux classique, tout en finesse : il est au sommet et ne gagnera plus beaucoup à attendre.', ['Gigot d’agneau', 'Filet de bœuf', 'Canard rôti', 'Comté vieux']],
  ['Vieilles Vignes', 'Domaine de l’Exemple', 4, 'Rouge', 'Gevrey-Chambertin', 'Pinot noir', 2, 55, 6, 14, 'Un bourgogne structuré sur de vieilles vignes, encore serré : il demande quelques années.', ['Volaille rôtie', 'Boeuf bourguignon', 'Champignons', 'Époisses']],
  ['Terrasse du Roi', 'Domaine Démo', 6, 'Rouge', 'Hermitage', 'Syrah', 2, 70, 8, 20, 'Une syrah de coteau granitique, puissante et épicée, faite pour la longue garde.', ['Gibier', 'Côte de bœuf', 'Daube provençale', 'Fromages corsés']],
  ['La Source', 'Château Exemple', 3, 'Rouge', 'Côtes du Rhône', 'Grenache, Syrah', 6, 12, 1, 5, 'Un rouge de tous les jours, fruité et gourmand, à boire dans sa jeunesse.', ['Grillades', 'Pizza', 'Pâtes à la bolognaise', 'Charcuterie']],
  ['Les Granits', 'Domaine Démo', 2, 'Rouge', 'Morgon', 'Gamay', 4, 16, 1, 6, 'Un beaujolais de granit, croquant et épicé, qui se boit frais.', ['Charcuterie', 'Poulet rôti', 'Andouillette', 'Saint-Marcellin']],
  ['Cuvée Ancienne', 'Château Démo', 16, 'Rouge', 'Madiran', 'Tannat', 1, 28, 6, 14, 'Un madiran à l’ancienne : son temps est passé, à ouvrir sans attendre.', ['Cassoulet', 'Confit de canard', 'Bœuf grillé', 'Fromage de brebis']],
  ['Les Clous', 'Domaine Exemple', 5, 'Blanc', 'Chablis premier cru', 'Chardonnay', 3, 34, 3, 10, 'Un chablis tendu et minéral, sur sol de calcaire à huîtres.', ['Huîtres', 'Poisson grillé', 'Fruits de mer', 'Chèvre frais']],
  ['Coteaux d’Or', 'Domaine Démo', 12, 'Blanc', 'Vouvray', 'Chenin', 2, 22, 5, 20, 'Un chenin demi-sec qui prend du miel et de la profondeur avec les années.', ['Volaille à la crème', 'Poisson en sauce', 'Cuisine thaïe', 'Fromages bleus']],
  ['Clos Lumière', 'Château Exemple', 1, 'Blanc', 'Sancerre', 'Sauvignon', 3, 19, 1, 3, 'Un sancerre vif et citronné, pensé pour être bu jeune.', ['Crottin de chavignol', 'Poisson', 'Asperges', 'Salades']],
  ['Rosé de Soif', 'Domaine Démo', 1, 'Rosé', 'Bandol', 'Mourvèdre, Grenache', 4, 18, 0, 2, 'Un rosé de Provence sec et gastronomique, à boire dans l’année ou la suivante.', ['Bouillabaisse', 'Grillades de poisson', 'Tapas', 'Salade niçoise']],
  ['Brut Réserve', 'Maison Exemple', null, 'Pétillant', 'Champagne', 'Pinot noir, Chardonnay, Meunier', 3, 42, -1, 3, 'Un brut sans année, assemblé pour la régularité : prêt à servir.', ['Apéritif', 'Fruits de mer', 'Poisson fumé', 'Gougères']],
  ['Crémant de Démonstration', 'Domaine Exemple', null, 'Pétillant', 'Crémant d’Alsace', 'Pinot blanc, Auxerrois', 6, 14, 0, 2, 'Un crémant frais et simple pour les occasions de tous les jours.', ['Apéritif', 'Tartes salées', 'Fromages frais', 'Dessert aux fruits']],
  ['Moelleux d’Automne', 'Château Démo', 10, 'Blanc', 'Sauternes', 'Sémillon, Sauvignon', 2, 48, 8, 30, 'Un liquoreux de botrytis, concentré et onctueux, qui vieillit très longtemps.', ['Foie gras', 'Roquefort', 'Tarte aux abricots', 'Volaille aux fruits secs']],
  ['Les Hauts de Démo', 'Domaine Exemple', 7, 'Blanc', 'Alsace grand cru', 'Riesling', 2, 27, 4, 15, 'Un riesling de grand cru sec et droit, à la finale saline.', ['Choucroute', 'Poisson en sauce', 'Cuisine asiatique', 'Munster']],
];

// `annee` : année en cours. Les millésimes et les périodes de garde se calent sur elle, pour montrer tous les états (à garder, prêt, urgent).
export function demoWines(annee) {
  const now = Date.now();
  return LISTE.map(([name, dom, age, color, region, grape, qty, price, f, t, story, pairings], i) => {
    const base = age == null ? annee : annee - age;
    return {
      id: DEMO_PREFIX + (i + 1), name, dom, year: age == null ? '' : annee - age, color, region, grape, qty, price,
      from: base + f, to: base + t, story, pairings,
      note: 'Vin de démonstration (fictif).',
      src: { grape: 'user', story: 'user', pairings: 'user', from: 'user', to: 'user' },
      conf: 'estimée', created: now, updated: now,
    };
  });
}
