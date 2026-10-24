# Bible des vins : points fragiles à retravailler

*Tenu à jour au fil de la constitution (23 octobre 2026). Bible assemblée : 412 appellations, 5 880 lignes, fiabilité A 23 % / B 52 % / C 24 %. Rien de ce qui est listé ici ne doit être présenté à l'utilisateur comme certain. Les lignes de fiabilité C ne sont pas affichées dans l'appli ; A et B le sont avec la mention « estimation ».*

## 1. Limites générales (valables pour toutes les zones)
- **Fenêtres d'apogée et de dégustation** (`apogee_debut`, `apogee_fin`, désormais la fenêtre de dégustation) : **calculées** par `apogee.js` (pic par appellation, largeur selon la catégorie du vin, note du millésime), jamais lues dans une source ; voir `data/METHODE-FENETRES.md`. À remplacer progressivement par des données sourcées (guides de garde, dégustations récentes sur La Passion du Vin / CellarTracker).
- **Notes par appellation** : la plupart des sources ne notent que la région ; les différences entre appellations viennent souvent de commentaires de producteurs ou de la connaissance. À consolider appellation par appellation avec des sources indépendantes.
- **Avis 2024 et 2025** : provisoires (primeurs, bilans de vendanges, avis de producteurs). À revérifier en 2027, à la mise en bouteille.
- **Sites non lus ou illisibles pendant la constitution** : Vinatis, Millésima, V and B, CellarTracker (souvent), Comptoir des Millésimes (partiel), tableau Hachette 2005-2013 (en-têtes en images), Viniphile (grille en image). Les relire quand ils sont accessibles.
- **Une seule voix** : plusieurs lignes ne reposent que sur une source (signalées par les agents) ; les rechercher.
- **Notes du Guide Hachette** (sur 20) : utilisées comme signal, converties en 1-5, jamais recopiées ; leur lecture est incomplète (2014-2023 seulement, par région).

## 2. Points fragiles connus par zone
- **Zone 1 Bordeaux rive gauche** (refaite 2005-2025, 37 % A / 63 % B) : Sauternes-Barsac reste le plus fragile (2012=2, 2018=3, 2024=3, 2025=4 avec avis divergents, 2008=4) ; Margaux 2016 et 2022 (régularité discutée) ; Pauillac et Saint-Estèphe 2025 (5, primeurs) ; blancs de Pessac-Léognan 2007 (5, une seule source) ; Médoc/Haut-Médoc 2007, 2008, 2012 (écart déduit d'une phrase) ; séries Graves et Cérons/Graves Supérieures reprises de Pessac-Léognan et de Sauternes-Barsac (B) ; blancs 2005-2011 surtout de connaissance ; millesima.fr et bordeaux.com illisibles, CellarTracker et INAO non consultés.
- **Zone 2 Bordeaux rive droite** : lignes à 5 sans source contradictoire (liquoreux 2005/2009/2010/2011, blancs secs 2019, rouges 2005 et 2020) ; satellites (Fronsac, Castillon, Blaye) reprennent la note de Saint-Émilion ; Bordeaux/Bordeaux Supérieur plafonnés à 4 sans source ; Vinatis illisible.
- **Zone 3 Bourgogne Côte d'Or** : distinction Côte de Nuits / Côte de Beaune appuyée sur le seul Wine Spectator ; premiers/grands crus non distingués des villages (plafond B) ; rouges 2025 provisoires ; Corton, Aloxe-Corton, Pommard, Volnay rouge 2024 (une source).
- **Zone 4 Chablis / Chalonnaise / Mâconnais** : Irancy, Mâcon rouge et petites appellations de l'Yonne déduits de la région (C) ; Crémant de Bourgogne en NC (non millésimé) ; Côte chalonnaise rouge sans source année par année ; colonnes Hachette rouge/blanc déduites.
- **Zone 5 Beaujolais** : blancs 2005-2010, 2024, 2025 en C ; différences entre crus supposées ; notes 5 de 2015, 2019, 2022 (Morgon, Moulin-à-Vent, Fleurie) en B.
- **Zone 6 Rhône nord** : blancs de Château-Grillet alignés sur Condrieu ; Hermitage 2009 (5) et blanc 2019 (5) ; Diois tranquille et effervescent (C) ; Saint-Péray effervescent (C) ; Collines Rhodaniennes dérivées de la région ; notes d'Hermitage, Cornas, Crozes issues de commentaires de producteurs.
- **Zone 7 Rhône sud** : 37 % de lignes en C ; Luberon, Costières de Nîmes, Grignan-les-Adhémar = proxy régional ; Muscat de Beaumes-de-Venise en NC ; village nommés confidentiels (Puyméras, Roaix…) en C ; 2024 Gigondas, Vacqueyras, Ventoux (une seule voix) ; blancs de Châteauneuf avant 2021.
- **Zone 12 Champagne** : styles et grandes zones ne sont pas des AOC distinctes (sous-catégories de l'AOC Champagne) ; différences entre zones déduites des cépages (chardonnay / pinot / meunier), pas de sources par zone ; Blanc de Blancs 2020 (5) et 2015 (3) ; Côte des Bar 2024 inconnue (C) ; Coteaux Champenois tous en C ; Rosé des Riceys sans série de millésimes (le validateur refuse la couleur Ro dans les millésimes : à décider) ; pas de liste fiable d'années déclarées ; contrôle à froid de 15 % non fait.
- **Zone 11 Alsace** (65 % A / 31 % B / 2 % C) : Crémant d'Alsace 2021, 2024, 2025 ; Pinot Noir 2021, 2024, 2025 ; Riesling, Gewurztraminer, Pinot Gris 2025 (provisoire) ; Vendanges Tardives et Sélection de Grains Nobles 2013, 2014, 2022, 2023 (divergences sur le botrytis) ; VT et SGN 2025 en NC ; pages vinsalsace.com 2016 et 2020-2025 illisibles ; Grand Cru traité en bloc (51 lieux-dits non distingués).
- **Zone 8 Languedoc-Roussillon** (5 % A / 62 % B / 32 % C) : 2025 toutes séries (3, C) ; Corbières et Corbières-Boutenac 2025 en NC (incendie) ; rouges de l'ouest audois 2014 et 2024 ; Fitou 2025 ; Minervois 2024 ; Limoux blanc 2024 ; Picpoul de Pinet 2022 ; vins doux (Banyuls, Maury, Rivesaltes) déduits du Roussillon rouge ; blancs 2005-2009 estimés d'après les rouges ; sous-zones sans source propre en B ; Idealwine 2005-2009 sans analyse, Comptoir des Millésimes illisible.
- **Zone 9 Provence et Corse** (9 % A / 44 % B / 46 % C, 100 lignes NC) : 2025 en NC partout ; Corse 2005-2007, 2008-2010 et 2014 (NC), 2017 et 2023 ; Patrimonio rouge 2013 ; Bellet 2016 ; Pierrevert, Palette, IGP Méditerranée (toutes années) ; le rosé n'a pas de série (le validateur refuse la couleur Ro dans les millésimes : à décider, c'est pourtant l'essentiel de la Provence) ; Hachette Provence : seule la colonne rouge est lisible ; Bandol 2007 (4), 2016 (5), 2019 (4) divergents.
- **Zone 13 Sud-Ouest, Jura, Savoie** (A 27, B 528, C 432 sur 987 lignes) : 625 lignes citent seulement « connaissance » ; les sites non lus ont été retirés des sources (viniphile.fr, vinsetmillesimes.com, lacompagniedesbonnesbouteilles.fr, safer-occitanie.com, thedrinksbusiness.com, lagazettefrance.fr) ; les rouges du Sud-Ouest recopiaient la note régionale Hachette à toutes les appellations ; Arbois blanc 2017 passait en A alors que macommune le décrit comme très difficile (corrigé) ; Hachette Jura et Savoie : colonnes vides ; Viniphile en image ; Jancis Robinson sans millésimes ; Bugey, Seyssel, crémants en NC ou quasi ; la plupart des années 2005-2013, 2025 et Monbazillac non sourcées ; Pécharmant, Monbazillac, Saussignac, Cahors, Madiran, Jurançon : sources partielles (idealwine, Hachette Sud-Ouest 2014-2023, La Passion du Vin en fils de forum).
- **Zone 10 Loire** : voir la section dédiée plus bas.

## 3. Questions de structure à trancher
- Couverture **Bourgogne régional, Aligoté, Passe-Tout-Grains, Crémant de Bourgogne** : présente dans le référentiel (zones 3 et 4) ; Coteaux Bourguignons en zone 13. Aucun doublon d'appellation à l'assemblage. Reste à vérifier la qualité des séries de ces appellations, qui sont en grande partie déduites de la région.
- **« proches » hors zone** : tous les avertissements du validateur doivent se résoudre à l'assemblage.
- **Alias et graphies** (Morgon, morgon, « Gevrey Chambertin ») : dictionnaire à construire pour la correspondance région → appellation.
- **Appellations oubliées** : relire la liste INAO complète (IGP majeures, VDN, vins doux naturels, crémants) une fois les 13 zones assemblées.

## 4. Mise à jour annuelle
Chaque automne : nouveau millésime (2026 à l'automne 2027), revérification des deux précédents, relecture des lignes C.

## Contrôle croisé du 22/10/2026 (deux IA indépendantes, 23 lignes)
- Notes confirmées : Sauternes 2012 (2), 2018 (3), Alsace VT 2022 (passée à 4), Morgon 2015/2019/2022, Champagne BdB 2020, Gigondas et Vacqueyras 2024.
- Notes révisées : Saint-Estèphe 2025 passée de 5 à 4 (tri plus exigeant qu'à Pauillac).
- Désaccords gardés avec fiabilité plus basse : Sauternes 2008 (4 ou 3 selon la source, fiabilité C), Margaux 2016 et 2022 (4 ou 5), Pessac-Léognan blanc 2007 (4 ou 5), Ventoux 2024 (3 ou 4), Champagne BdB 2015 (3 ou 4), Sauternes 2024 (3 ou 4).
- 2025 : avis provisoires uniquement (primeurs), jamais au-dessus de la fiabilité B.
- Limite : une des deux IA n'a pas pu citer de source pour 2025, l'autre a cité des revues et des sites de vente. Les lectures de pages ne sont pas vérifiables de notre côté.

## Zone 10 Loire (23 octobre 2026)
- Notes posées par groupe (« Muscadet et Gros Plant », « Liquoreux d'Anjou », etc.), pas appellation par appellation : le brief demande de différencier, ce n'est pas fait.
- Appellations sans millésimes : Cheverny, Cour-Cheverny, Valençay, Jasnières, Orléans, Coteaux du Giennois, Châteaumeillant, Pouilly-sur-Loire, Coteaux de Saumur.
- Fenêtres d'apogée modélisées (type × qualité), non lues.
- Prix et garde : connaissance générale, non sourcés.
- Sources lues : winescholarguild.com, idealwine.com, jancisrobinson.com, vinsdeloire.fr, vins-centre-loire.com, divineloire.fr, thedrinksbusiness.com. Illisibles : Hachette (grille Loire absente), Viniphile (grille en image), La Passion du Vin (pas de données Loire), Vinous et Wine Spectator (cépages seulement), INAO non consulté.
- Lignes douteuses : Muscadet 2009 (5, une source donne 4) ; Liquoreux d'Anjou 2005/2009/2015 (5, note de groupe) ; Chinon 2005 et 2022 (5) ; Savennières 2010 (5, régional seulement) ; Liquoreux d'Anjou 2024 (3, C, source « poor », à réviser vers 2) ; Sancerre rouge 2024 (2, C) ; Saint-Nicolas-de-Bourgueil 2024 (2, B) ; Touraine rouge 2017 (3, A, gel local, note de région).

## Zone 13 : intégration de la vérification par une seconde IA (23 octobre, 2e passe)
- Intégré : Monbazillac, Pécharmant, Saussignac, Cahors, Madiran, Jurançon sec et moelleux, Arbois, Côtes du Jura, L'Étoile, Château-Chalon, Crémant du Jura, et une ligne de Roussette de Savoie (2014).
- Non intégré, à demander : le reste de la Roussette de Savoie, Vin de Savoie, Crémant de Savoie, Seyssel, Bugey, Pétillants du Bugey, Bugey-Cerdon, Coteaux Bourguignons, Pacherenc du Vic-Bilh, Béarn/Tursan/Saint-Mont, Irouléguy, Bergerac et satellites, Gaillac, Marmandais, Aveyron et Quercy, IGP Comté Tolosan, liquoreux du Sud-Ouest.
- Lignes à « potentiel » et non qualité : Château-Chalon 2020 (5) : le guide note le potentiel, non la qualité du vin.
- Sources annoncées mais non vérifiables de notre côté : millesimes.fr, vin-de-cahors.fr, irqualim.fr, vin-malin.fr, reussir.fr, terredevins.com. Elles sont inscrites comme lues par l'autre IA, pas par nous.
- Plusieurs notes reposent sur une seule source (guide Figaro, ligne régionale) : fiabilité B, à consolider.
