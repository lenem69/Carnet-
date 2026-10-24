// Nouveautés affichées une fois, après une mise à jour. Une ligne courte par changement, du point de vue de l'utilisateur.
export const NOTES = {
  '1.25.2': ['IA gratuite : sans clé à vous, l’IA est limitée à un vin par jour (fiche, scan, suggestion…). Pour l’utiliser sans cette limite, ajoutez votre propre clé gratuite dans ⚙ Réglages.'],
  '1.25.1': ['IA gratuite : quand le service gratuit est indisponible, l’appli le dit clairement (au lieu de « Clé IA refusée ») et réessaie plus tard. Un même message ne s’affiche plus trois fois. L’avis de Magic ne se prépare plus qu’avec votre propre clé : il ne consomme plus vos fiches gratuites du jour.'],
  '1.25.0': ['Magic, Que boire ? et Ma cave : ces trois boutons sont plus grands et en or, pour les repérer d’un coup d’œil. Avis IA : sans clé à vous, l’appli peut vous aider pour 5 vins par jour et par appareil ; au-delà, une fenêtre vous indique comment ajouter votre propre clé gratuite Gemini dans ⚙ Réglages (lien et bouton « Copier l’adresse »).', 'iPhone : l’appli s’ouvre en plein écran depuis l’écran d’accueil, sans que la barre du bas ou le bouton + ne passent sous la barre du système. Le double toucher ne zoome plus.'],
  '1.24.0': ['Magic : l’avis sur l’équilibre existe en version courte et en version complète (à dérouler). Il est préparé à l’installation de cette version, puis mis à jour tout seul à chaque ajout ou suppression de vin. Plus de bouton à toucher.'],
  '1.23.0': ['Magic : l’avis sur l’équilibre de votre cave s’affiche directement, avec votre prénom s’il est renseigné. Il se met à jour tout seul après l’ajout ou la suppression d’un vin, en arrière-plan. Sans crédit d’IA, l’avis précédent reste affiché, avec sa date.', 'Réglages › Nouvelles versions : sur Android, une notification vous prévient quand une nouvelle version est publiée, même appli fermée (à activer une fois).'],
  '1.22.0': ['Fenêtres : une croix en haut à droite pour fermer. On peut aussi les fermer en glissant vers le bas, depuis la moitié haute. Si une saisie n’est pas enregistrée, l’appli demande confirmation avant de l’abandonner.'],
  '1.21.1': ['Valeur estimée : toucher le montant ou son libellé le cache ou le réaffiche.'],
  '1.21.0': ['La valeur estimée de la cave se met à jour toute seule, en même temps que les fiches (sans effort de votre part). Correction : la mise à jour des fiches en arrière-plan échouait depuis la version 1.18.'],
  '1.20.0': ['Magic : un constat sur l’équilibre de la cave, avec un avis de l’IA en option. Valeur estimée de la cave (IA, indicative : peu de prix d’achat sont saisis), à estimer quand vous voulez.'],
  '1.19.0': ['Magic : touchez une case (Prêt à boire, À garder, Urgence) pour voir la liste des vins concernés. Touchez la pastille en haut de la liste pour revenir à toute la cave. Première ouverture : un message de bienvenue vous demande votre prénom.'],
  '1.18.0': ['Fiches : la bible remplit d’abord la garde. Ensuite, l’IA complète les fiches par lots de 10 vins, à partir de ses connaissances ; la recherche web (Gemini) ne sert qu’aux champs restés vides ou incertains, par lots de 5. Une cave importée est traitée toute seule. Vos saisies restent intactes.'],
  '1.17.0': ['Les fiches se mettent à jour toutes seules : sur Android, Chrome lance la mise à jour de fond environ deux fois par jour, même appli fermée. Sur iPhone, elle se fait à l’ouverture de l’appli. L’IA peut aussi reprendre les anciennes fiches ; vos saisies récentes restent intactes.'],
  '1.16.0': ['Fiches : l’IA peut corriger les cépages, histoires, accords et gardes, sauf ce que vous avez saisi vous-même. Chaque vin est vérifié une fois, après son enregistrement.'],
  '1.15.0': ['Journal de dégustation : sur la fiche de chaque vin, notez une dégustation sur 5 étoiles, avec la date et un commentaire. La moyenne s’affiche sur la carte.'],
  '1.14.0': ['« Que boire ? » : le classement tient compte des fenêtres à boire (saisies, bible ou apogée). Nouveau mode « Apogée ».'],
  '1.13.2': ['Apogée : les premiers crus vieillissent 12 ans, les blancs de Bourgogne villages 6 ans, les régionaux 4 ans.'],
  '1.13.1': ['L’apogée de chaque vin s’affiche directement sur sa carte, sans ouvrir la fiche.'],
  '1.13.0': ['Apogée : la fiche de chaque vin indique sa période optimale de consommation (estimée à partir du millésime, de la couleur et de la région). Les vins sans millésime sont prêts à boire.'],
  '1.12.5': ['Import souple : toutes les feuilles du fichier sont lues, y compris les listes de caviste (prix, quantités, couleurs par section). Les vins ainsi lus sont marqués « à vérifier ».'],
  '1.12.4': ['Magic : les appellations écrites avec des fautes, « 1er cru », « Grand cru » ou « AOP » sont reconnues. Les vins français sans appellation reconnue vont dans « Vin de France », les vins étrangers dans « Étranger ».'],
  '1.12.3': ['Import Excel : la colonne « Nombre de bouteilles » reste la quantité ; « Appellation » est lue comme appellation ; le format (1,5 L…) et « Effervescent » sont pris en compte. Les fiches mal importées sont réparées automatiquement.'],
  '1.12.2': ['Import : « 2 bouteilles de… » dans le nom devient une quantité de 2 (et le nom est nettoyé). Vos fiches existantes sont corrigées automatiquement.'],
  '1.12.1': ['Ouvrir le lien depuis le navigateur affiche d’abord comment installer l’appli, avec un bouton « Continuer sans installer ».'],
  '1.12.0': ['Installation simplifiée : bouton « Installer » sur Android, pas-à-pas animé sur iPhone.', 'Clé Gemini : bouton « Obtenir ma clé gratuite » ; modèle et adresse repliés dans « Options avancées ».', 'Bouton « Signaler un problème » en bas de page.'],
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
