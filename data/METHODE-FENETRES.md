# Méthode : apogée et fenêtre de dégustation (version 1.30.0)

Une seule source de vérité : `apogee.js` (avec `crus.js` pour lire le rang d'un vin). La bible (`bible/bible.json`) ne contient que des fenêtres calculées par ce code, jamais éditées à la main.

## Le calcul
1. **Durée au pic** (années après la récolte, pour un **bon millésime, note 4**) = **durée de base de l'appellation × coefficient de rang**, arrondie.
   - Durée de base : table de référence (`apogee-table.js`, fiabilité A ou B), sinon `PAR_APPELLATION`, sinon règle générale par couleur et région.
   - Coefficient de rang (voir « Rang du vin ») : 1 pour un vin sans rang particulier.
2. **Note du millésime** (1 à 5 dans la bible) : décale le pic, proportionnellement à la durée de vie du vin (note 1 : -40 %, 2 : -25 %, 3 : -10 %, 4 : 0, 5 : +25 %). Sans note, c'est la référence (note 4). Les ordres de grandeur suivent Clive Coates : un grand millésime ajoute environ un quart, un millésime faible en retire un quart.
3. **Forme de la fenêtre**
   - **Bourgogne et Chablis** : apogée de 0,8 à 1,2 fois la durée au pic, garde (fenêtre de dégustation) de 0,6 à 1,4 fois. Blancs de la Côte de Beaune de 1996 à 2014 (oxydation prématurée) : fin d'apogée -20 %, fin de garde -15 %.
   - **Autres régions** : apogée = pic ± h (h selon la catégorie : léger ≤ 3 ans 1, courant 2, structuré 8-11 2, prestige 12-19 3, longue garde ≥ 20 4). Fenêtre = apogée élargie d'une marge avant (1 à 4 ans) et d'une marge après proportionnelle à la durée de vie (prestige 0,8 ×, plafonnée à 12 ; ≥ 22 ans : 0,55 ×, plafonnée à 14 ; structuré 0,9 × ; courant 3 à 4 ans ; léger 2), corrigée par la note du millésime.
4. **Cohérence** : l'apogée est toujours à l'intérieur de la fenêtre (testé sur chaque millésime de la bible, `tests/unit.mjs`).

## Rang du vin (`crus.js`)
Le rang se lit dans la **région** et le **nom** de la fiche (jamais dans le domaine seul : un domaine « Clos de Tart » fait aussi du village).
- **Bourgogne et Chablis** : village ×1, **premier cru ×1,5** (mention « 1er cru » ou « premier cru », le climat n'a pas besoin d'être connu), **grand cru ×2,2** (33 grands crus reconnus par leur nom ; Clos de Vougeot et Ruchottes-Chambertin, plus souples : ×1,8). **Super premiers crus** (Clos Saint-Jacques, Cros Parantoux, Les Amoureuses, Les Perrières de Meursault) : ×2,2, comme un grand cru ; ils exigent la bonne commune (« Perrières » existe ailleurs). Base = durée du village de la commune.
- **Bordeaux** (coefficient sur la durée de l'appellation) : premiers crus classés ×1,85 (Haut-Brion et La Mission ×2,0), deuxièmes ×1,45, troisièmes à cinquièmes ×1,1 (au moins 13 ans), crus classés de Graves ×1,15, Saint-Émilion premier grand cru classé A ×2,0 et B ×1,55, grands noms de Pomerol ×1,5 (Pétrus, Le Pin ×2,0), Sauternes et Barsac ×1,15 (Yquem ×1,5), grands blancs de Pessac-Léognan ×2,5. Les **seconds vins** et homonymes (Forts de Latour, Pavillon Rouge, Les Carmes Haut-Brion…) n'héritent pas du rang.
- **Champagne** : cuvée de prestige (Dom Pérignon, Cristal, Krug…) ×1,8 de la durée du millésimé.
- **Alsace** : grand cru ×2, lieu-dit ×1,4, sur la durée du cépage ; un Alsace simple suit la durée de son cépage. **Vendanges Tardives ×2** et **sélection de grains nobles ×3,5** sur la durée du cépage (Riesling 6 ans : 12 et 21).
- **Champagne** : Blanc de Blancs millésimé +20 % (12 ans au lieu de 10). Un champagne sans millésime (brut sans année) n'a pas de date d'apogée : l'appli n'en a aucune pour le dater.
- **Vin jaune** (Château-Chalon, « Vin Jaune » d'Arbois…) : début d'apogée fixe à millésime + 10 ans, apogée jusqu'à + 40 ans, garde de + 8 à + 50 ans (bon millésime). **Grands liquoreux de la Loire** (Quarts-de-Chaume, Bonnezeaux) : apogée de + 20 à + 45 ans, garde de + 15 à + 60 ans. La note du millésime n'allonge ces fenêtres que de 10 % au plus. Les autres liquoreux (Coteaux du Layon, Sauternes…) gardent leur règle.
- **Cuvées parcellaires et domaines de référence** (Rhône, Provence, Loire, Languedoc) : durée propre, retenue seulement si elle dépasse celle de l'appellation.
- Ces vins portent l'origine **« calc »** : l'appli leur calcule leur fenêtre (`fenetreRang`) au lieu de reprendre la ligne de la bible, qui décrit l'appellation. Une garde saisie à la main (« user ») n'est jamais remplacée. Le service worker (`fond.js`) ne touche pas aux fenêtres « calc ».

## Appellations regroupées et lignes dérivées
- La bible de travail (`data/zones`) range certaines appellations sous un nom de regroupement (`regroupements.tsv`). `etendre-regroupements.mjs` crée une ligne par appellation membre.
- `etendre-niveaux.mjs` ajoute les « <commune> Premier Cru » qui n'avaient pas de ligne (Fixin, Vougeot, Ladoix, Pernand-Vergelesses, Monthélie, Auxey-Duresses, Maranges, Blagny, Rully, Mercurey, Givry, Montagny) et deux grands crus (Mazoyères-Chambertin, La Grande Rue). Lignes **dérivées** (notes de la commune, fenêtre calculée) : fiabilité plafonnée à B.
- L'appli retrouve une appellation sous ses écritures courantes (`nomsBible`, identique dans `logic.js` et `fond.js`) : « Chassagne-Montrachet 1er Cru Contrôlée », « Rully 1er Cru Les Chapitres », « Corton Grand Cru », « Bourgogne Saint-Aubin », sans tirets ni accents. Un premier cru n'est jamais rabattu sur la ligne du village.

## Reconstruire la bible
Depuis la racine du dépôt : `sh data/construire-bible.sh` (assemblage et contrôle, recalcul des fenêtres, génération du JSON, extension des regroupements, ajout des niveaux). Puis `cd tests && npm test`.

## Limites connues
- Les durées de base et les coefficients de rang sont des estimations de dégustation (Clive Coates pour la Bourgogne ; connaissance pour le reste), pas des mesures. Seules les durées de base de la table A/B sont sourcées.
- La note du millésime (1 à 5) est celle de la bible ; elle ne dit rien du profil du millésime (solaire, classique, concentré, fluide) : ce profil n'est pas modélisé.
- Les coefficients millésime par millésime proposés dans certains rapports n'ont pas été retenus : sans source, ils donneraient une fausse précision.
- Éléments du rapport volontairement non repris (décision de Jeff, 25 octobre) : rive gauche étirée ×1,2 / rive droite -10 % de Bordeaux et étirement ×0,8 de tous les blancs de Bourgogne. Non repris faute de données : brut sans année de grande maison (pas de date de dégorgement), millésimes très acides de Champagne (liste d'années à fournir), cru bourgeois ×1,1 (pas de liste).
- Vin jaune et grands liquoreux de la Loire : fenêtres de 40 à 45 ans fixées d'après le rapport de Jeff ; aucune source indépendante trouvée pour ces durées.
- Trois lignes A de la table pour des grands crus de Bourgogne (Bonnes-Mares, Chambertin-Clos de Bèze, Corton-Charlemagne) sont écartées au profit du calcul par niveau.
- Liste de Saint-Émilion « A » : reprend Ausone, Cheval Blanc, Angélus, Pavie, Figeac ; le classement officiel a changé en 2022 (liste à relire). Pomerol n'a pas de classement officiel : la liste des grands noms est un choix éditorial.
- Liste des grands crus d'Alsace saisie de mémoire (51 noms) : à relire contre la liste INAO.
- Premiers crus de Pouilly-Fuissé (depuis 2020) et de Côte de Nuits-Villages non traités.
- Hermitage rouge : la table (fiabilité A) donne +11 ans, ce qui paraît court pour un vin de très longue garde.
