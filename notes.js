// Nouveautés affichées une fois, après une mise à jour. Une ligne courte par changement, du point de vue de l'utilisateur.
export const NOTES = {
  '1.11.0': ['L’onglet « Magic » (ex-Chiffres) : anneaux pour les couleurs et les régions, et trois statuts : Prêt à boire, À garder, Urgence.', 'Cépages fusionnés (« 100 % Syrah » = « Syrah ») ; régions classées du plus général au plus précis.', 'Thème clair en permanence ; le bloc « En résumé » est retiré de Magic, et les trois chiffres du haut n’y sont plus répétés.'],
  '1.10.0': ['Les nouvelles fiches reçoivent une période de garde indicative (bible des vins) ; vos saisies ne sont jamais modifiées.'],
  '1.9.0': ['Nouvel onglet « Chiffres » : la répartition de votre cave, couleurs, régions, cépages, et l’année où vos bouteilles sont à boire.'],
  '1.8.3': ['Le bandeau « Nouvelle version prête » ne recouvre plus le contenu, et ses messages s’affichent sous lui.'],
  '1.8.1': ['Les fenêtres d’information s’affichent l’une après l’autre, sans se superposer.'],
  '1.8.0': ['Les fiches incomplètes se complètent toutes seules en arrière-plan (réglable dans Réglages).', 'Statistiques anonymes facultatives pour améliorer l’appli (vous choisissez).'],
  '1.7.0': ['Aide et contact : « Publier ma requête » envoie votre retour directement.', 'Le bandeau de mise à jour est plus visible.'],
  '1.5.0': ['Choix automatique de l’IA : si l’une atteint sa limite, l’appli passe à une autre.'],
  '1.4.0': ['Fiches « vérifiées » (avec sources cliquables) ou « estimées ».'],
};
const num = v => String(v).split('.').map(n => parseInt(n, 10) || 0);
export function cmp(a, b) { const x = num(a), y = num(b); for (let i = 0; i < 3; i++) { if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) - (y[i] || 0); } return 0; }
// Lignes à montrer pour passer de `seen` à `cur` (les plus récentes d'abord, 6 au maximum).
export function since(seen, cur) {
  return Object.keys(NOTES).filter(v => cmp(v, seen) > 0 && cmp(v, cur) <= 0).sort((a, b) => cmp(b, a)).flatMap(v => NOTES[v]).slice(0, 6);
}
