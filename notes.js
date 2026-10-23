// Nouveautés affichées une fois, après une mise à jour. Une ligne courte par changement, du point de vue de l'utilisateur.
export const NOTES = {
  '1.8.3': ['Le bandeau « Nouvelle version prête » ne recouvre plus le contenu de l’appli, et son bouton est toujours visible.', 'Les messages courts s’affichent en bas de l’écran.'],
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
