# Méthode : apogée et fenêtre de dégustation (version 1.31.0)

Une seule source de vérité : `apogee.js` (avec `crus.js` pour lire le rang d'un vin). La bible (`bible/bible.json`) ne contient que des fenêtres calculées par ce code, jamais éditées à la main.

## Le calcul
1. **Durée au pic** (années après la récolte, pour un **bon millésime, note 4**) = **durée de base de l'appellation × coefficient de rang**, arrondie.
   - Durée de base : table de référence (`apogee-table.js`, fiabilité A ou B), sinon `PAR_APPELLATION`, sinon règle générale par couleur et région.
   - Coefficient de rang (voir « Rang du vin ») : 1 pour un vin sans rang particulier.
2. **Note du millésime** (1 à 5 dans la bible) : décale le pic, proportionnellement à la durée de vie du vin (note 1 : -40 %, 2 : -25 %, 3 : -10 %, 4 : 0, 5 : +25 %). Sans note, c'est la référence (note 4). Les ordres de grandeur suivent Clive Coates : un grand millésime ajoute environ un quart, un millésime faible en retire un quart.
3. **Forme de la fenêtre**
   - **Bourgogne et Chablis** : apogée de 0,8 à 1,2 fois la durée au pic. Garde (fenêtre de dégustation) : rouges de 0,5 à 1,4 fois ; blancs de village et de premier cru de 0,3 fois (au moins 3 ans quand la commune est connue) à 1,25 fois, blancs de grand cru de 0,45 à 1,25 fois. Blancs de la Côte de Beaune de 1996 à 2014 (oxydation prématurée) : fin d'apogée -20 %, fin de garde -15 %.
   - **Autres régions** : apogée = pic ± h (h selon la catégorie : léger ≤ 3 ans 1, courant 2, structuré 8-11 2, prestige 12-19 3, longue garde ≥ 20 4).
     - **Début de garde** = une part de la durée au pic : 0,5 pour les rouges (jamais plus de 10 ans : les critiques ouvrent la fenêtre des premiers crus classés 7 à 10 ans après la récolte), 0,4 pour les blancs secs, 0,33 pour les vins doux, 0,55 pour les champagnes. Un grand millésime (note 5) ne retarde pas le début.
     - **Fin de garde** = apogée + marge après, proportionnelle à la durée de vie (prestige rouge 0,8 ×, plafonnée à 12 ; prestige blanc sec 0,5 × ; structuré 0,9 × ; courant 3 à 4 ans ; léger 2 ; vins doux de 20 ans ou plus 0,35 ×, plafonnée à 12 ; 20-21 ans 6 ; 22 ans ou plus 0,55 ×, plafonnée à 14). **Rouges du Rhône, de Provence et du Sud-Ouest : marge × 0,65** (les critiques ferment la fenêtre plus près du pic qu'à Bordeaux). Un grand millésime n'allonge la fin que de 10 % de la durée au pic ; un millésime faible la raccourcit (-55 %, -45 %, -20 % de la durée au pic pour les notes 1, 2, 3).
   - **Vins doux** : reconnus par le mot liquoreux ou par le nom de l'appellation (Sauternes, Barsac, Saussignac, Loupiac, Sainte-Croix-du-Mont, Cérons, Cadillac, Premières Côtes de Bordeaux, Graves supérieures, Coteaux du Layon et autres liquoreux de la Loire, Monbazillac, Jurançon moelleux, Muscats doux, Rivesaltes, Maury, Banyuls).
4. **Cohérence** : l'apogée est toujours à l'intérieur de la fenêtre (testé sur chaque millésime de la bible, `tests/unit.mjs`).

## Rang du vin (`crus.js`)
Le rang se lit dans la **région** et le **nom** de la fiche (jamais dans le domaine seul : un domaine « Clos de Tart » fait aussi du village).
- **Bourgogne et Chablis** : village ×1, **premier cru ×1,5** (mention « 1er cru » ou « premier cru », le climat n'a pas besoin d'être connu), **grand cru ×2,2** (33 grands crus reconnus par leur nom ; Clos de Vougeot et Ruchottes-Chambertin, plus souples : ×1,8). **Super premiers crus** (Clos Saint-Jacques, Cros Parantoux, Les Amoureuses, Les Perrières de Meursault) : ×2,2, comme un grand cru ; ils exigent la bonne commune (« Perrières » existe ailleurs). Base = durée du village de la commune.
- **Bordeaux** (coefficient sur la durée de l'appellation) : premiers crus classés ×1,85 (Haut-Brion et La Mission ×2,0), deuxièmes ×1,45, troisièmes à cinquièmes ×1,1 (au moins 13 ans), crus classés de Graves ×1,15, Saint-Émilion premier grand cru classé A ×2,0 et B ×1,55, grands noms de Pomerol ×1,5 (Pétrus, Le Pin ×2,0), Sauternes et Barsac ×1,15 (Yquem ×1,5), grands blancs de Pessac-Léognan ×2 (Domaine de Chevalier blanc 2015 : critiques de 2020 à 2035). Les **seconds vins** et homonymes (Forts de Latour, Pavillon Rouge, Les Carmes Haut-Brion…) n'héritent pas du rang.
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

## Contrôle contre les fenêtres des critiques (1.30.1)
Le calcul est confronté à 47 fenêtres de dégustation publiées (45 dans la fourchette, 2 écarts connus bornés) (relevées le 25 octobre 2026 sur Lea & Sandeman, Justerini, Farr, Decanter : Vinous, Wine Advocate, Decanter, Jancis Robinson, Burghound, Wine Spectator, JebDunnuck). Test : `tests/unit.mjs`, bloc « repères publiés ». Règle : le début et la fin du calcul doivent tomber dans l'éventail des critiques, avec une marge de 2 ans sur le début et 3 sur la fin (3 et 6 ans quand moins de 3 fenêtres ont été relevées).
- Bordeaux rouge : Lynch-Bages 2014 et 2017, Léoville-Las Cases 2014, Pichon-Lalande 2016, Léoville-Barton 2016, Mouton 2017, Margaux 2016, Lafite 2015, Boyd-Cantenac 2016, Gruaud-Larose 2015, Pontet-Canet 2016, Canon 2015, La Conseillante 2015, Cambon la Pelouse 2015, Phélan Ségur 2016. Blancs et doux : Domaine de Chevalier 2015, Smith Haut Lafitte 2020, Rieussec 2007, 2015 et 2016, Guiraud 2016, Yquem 2007. Champagne : Bollinger 2012, Pol Roger Churchill 2013, Roederer Vintage 2015.
- Rhône, Provence, Sud-Ouest : Châteauneuf (Reine des Bois 2012 et 2016), Gigondas 2018, Cornas 2018, Crozes 2017, Hermitage La Chapelle 2015, Bandol Tempier 2016, Cahors 2014. Beaujolais : Fleurie 2020.
- Bourgogne : Chablis village 2019, 1er cru Côte de Léchet 2019, grand cru Les Clos 2018, Chassagne village 2018 et 1er cru Vide Bourse 2018 et 2019, Meursault 1er cru Genevrières 2018, Pouilly-Fuissé 1er cru 2020, Vosne village 2019, Suchots 2014, Morey-Saint-Denis 2015.
- **Écarts connus (bornés dans les tests)** : Dom Pérignon 2008 en magnum (Decanter : fin à +22 ans, les autres cuvées de prestige +18 à +38 ; le calcul donne +35) et Chablis 1er cru Vaillons 2018 (Jancis Robinson : début à +8 ; la Côte de Léchet donne +2 à +4 ; le calcul donne +3).
- **Écarts relevés mais non corrigés (une seule source ou désaccord entre critiques)** : Savennières 2019 (Vinous : +3 à +10 ; calcul +7 à +29), Coteaux du Layon Chaume 1er cru 2017 (L&S et Jancis : +3 à +8 ; calcul +7 à +31), Monbazillac Les Pins 2018 (Jancis : +2 à +5 ; calcul +7 à +33). Les fenêtres courtes de Jancis Robinson sur des liquoreux ne sont pas retenues seules. Mouton 2017 : critiques à +8, calcul à +10. Rully 1er cru 2017 et Meursault village 2015 sont « Passé » en 2026 (Coates : village blanc 3-8 ans).
- Les rouges de Bourgogne et les blancs de Bourgogne gardent des fins conservatrices (Coates) par rapport à Burghound et Vinous (Vosne village 2019 : calcul +14, critiques +10 à +26 ; Chassagne 1er cru 2018 : calcul +14, critiques +12 à +24).

## Domaines de référence (1.31.0)
- `crus.js` : `domaineReference(nom, domaine)` reconnaît 73 domaines (Bourgogne, Rhône, Loire, Alsace, Jura, Sud) avec le coefficient du rapport de Jeff (1,20 à 1,50).
- Effet réduit de moitié : durée au pic × (1 + (coefficient − 1) × 0,5). Aucune source publiée ne les confirme, d'où cette prudence.
- Jamais pour Bordeaux (le classement dit le rang), le champagne, les fenêtres fixes (vin jaune, grands liquoreux de la Loire), ni en plus d'une cuvée célèbre déjà retenue (Clos Rougeard, Trévallon, Peyre Rose, Grange des Pères, Rayas).
- Noms voisins non confondus : Olivier Leflaive, Leflaive & Associés (coefficient 1,20 au lieu de 1,35), Domaine de Chevalier (Bordeaux).
- Un vin de domaine reconnu compte comme « rang » : sa fenêtre est calculée (origine « calc »), jamais celle de l'appellation de la bible. Les saisies de l'utilisateur ne sont jamais remplacées.
- Rully 1er cru 2017 de Leflaive & Associés : garde 2020-2026 (2020-2025 sans le domaine). Les critiques donnent 2 à 8 ans : l'écart avec l'attente de Jeff reste, corrigeable à la main.

## Vins sans ligne dans la bible (1.31.0)
- Un rouge ou un blanc d'appellation ou de région reconnue, sans ligne dans la bible (Alsace simple, Vouvray, Barolo, Rioja, Napa…), reçoit la fenêtre calculée (origine « calc »). Région inconnue : rien n'est inventé.
- Vouvray et Montlouis demi-secs : durée × 1,4. Grands rouges étrangers (Napa, Sonoma, Barossa, Coonawarra, Maipo, Ribera del Duero, Priorat, Bolgheri…) : 12 ans au pic (ils prenaient 5 à 6 ans).
- Non repris du second rapport de Jeff : ses formules (début d'apogée = récolte + durée, millésime ×1,35 empilé) donnent Barolo 2016 à partir de 2034 et Hermitage 2015 jusqu'en 2047, au-delà de ce que publient les critiques. Hermitage hors La Chapelle, Côte-Rôtie, Saint-Joseph restent à confronter aux critiques.

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
- Hermitage rouge (hors cuvées reconnues comme La Chapelle) : la table (fiabilité A) donne +11 ans ; les critiques donnent +13 à +25 pour La Chapelle 2015 (calcul de cuvée : +10 à +30). Non vérifié pour les autres producteurs.
- Vins sans ligne dans la bible et sans rang reconnu (Alsace simple + cépage, Vouvray, Banyuls et Maury millésimés, vins étrangers non classés) : pas de fenêtre de garde proposée, seulement l'apogée calculée.
