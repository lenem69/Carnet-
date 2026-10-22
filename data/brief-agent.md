# Consigne commune aux agents « bible des vins » (une zone par agent)

Contexte : base de référence générale (aucune donnée personnelle) embarquée dans une appli de cave à vin hors connexion : classer par appellation, repérer les trous d'une cave, suggérer des appellations françaises à découvrir, signaler les millésimes réussis. Ton travail alimente un programme : formats stricts. Tu écris UNIQUEMENT dans `/home/claude/carnet-/data/zones/` (3 fichiers, voir plus bas). N'exécute AUCUNE commande git, ne touche à aucun autre fichier.

## Millésimes : 2005 à 2025 inclus (21 années)

## Méthode (sérieuse, croisée)
1. Établis la liste exhaustive des appellations de ta zone (AOC/AOP et IGP majeures) à partir de sources officielles ou interprofessionnelles (INAO, interprofessions). N'invente jamais une appellation.
2. Pour la qualité des millésimes, croise AU MOINS ces familles de sources, en LISANT réellement les pages (WebFetch ; si le texte est tronqué, relis avec `offset`) :
   - Tableaux de millésimes gratuits : Guide Hachette (https://www.hachette-vins.com/guide-vins/actualite-vin/487/les-meilleurs-millesimes-des-vins-de-france/ : notes /20 par région, 2014-2023 ; lire aussi la suite de la page avec offset=100000), Viniphile (https://www.viniphile.fr/content/26-carte-des-millesimes), Uncorked, Jancis Robinson (pages publiques), etc.
   - Sites de vente et d'enchères à fiches détaillées : Idealwine (analyses de millésime, cotes), Vinatis (notes de dégustation, fiches), Millésima, Comptoir des Millésimes, V and B.
   - Interprofessions de ta zone (bilans de millésime).
   - Forums et communautés lisibles sans compte : La Passion du Vin (lapassionduvin.com), CellarTracker si accessible. Si un site est bloqué ou illisible, ne le compte pas.
   - Bilans récents (2024, 2025) : presse spécialisée, interprofessions, sites de vente. Les avis de primeurs sont provisoires.
3. Conversion des notes tierces : /20 → qualite 1-5 : 18-20 = 5 ; 16-17 = 4 ; 13-15 = 3 ; 10-12 = 2 ; <10 = 1. Ces notes sont un signal parmi d'autres : ta valeur finale est une SYNTHÈSE de consensus pour un bon producteur, jamais une recopie. Ne republie aucune note d'un guide dans les fichiers, aucune citation, aucun lien ; écris tes propres formulations.
4. Quand une source ne distingue que la région (ex. « Bordeaux rouge »), n'en déduis pas de différences entre appellations sans autre indice. Si les sous-zones divergent réellement (ex. gel local, grêle, Saint-Estèphe vs Margaux), appuie-toi sur des sources qui le disent, sinon laisse la même note et fiabilité B.
5. Ta connaissance propre sert pour les millésimes anciens et pour interpréter, mais la fiabilité A exige au moins DEUX sources indépendantes réellement lues pendant ce travail pour ce (sous_zone, couleur, millésime) ou pour la région entière ce millésime. Un propriétaire qui juge son propre millésime n'est pas une source indépendante. Les millésimes 2024 et 2025 sont au mieux B.
6. Contrôle à froid : après rédaction, relis toi-même 15 % des lignes au hasard et toutes les lignes de qualité 1 ou 5, en cherchant une source contradictoire. Corrige ou rétrograde la fiabilité.

## Fichiers à produire (UTF-8, colonnes séparées par des TABULATIONS, aucun saut de ligne ni tabulation dans une cellule)
Remplace NN par le numéro de zone à deux chiffres.

### zNN-referentiel.tsv (en-têtes exactes)
zone	appellation	couleurs	cepages	style	familles_gout	proches	prix_indicatif_eur	garde_ans	notoriete	fiabilite	sources
- appellation : nom officiel court, un par ligne, aucune appellation en double.
- couleurs : codes R, B, Ro, E, D séparés par des virgules (E effervescent, D doux/liquoreux).
- cepages : 1 à 4, séparés par des virgules. style : 12 mots maximum, rédigés par toi.
- familles_gout : 1 à 3 valeurs EXCLUSIVEMENT parmi leger-fruite, elegant-frais, puissant-structure, rond-gourmand, epice-mediterraneen, mineral-tendu, riche-boise, aromatique-floral, moelleux-liquoreux, effervescent.
- proches : 1 à 3 appellations françaises au profil voisin (noms officiels, de ta zone ou d'ailleurs).
- prix_indicatif_eur : fourchette courante d'une bouteille standard, ex. 15-40. garde_ans : ex. 5-15. notoriete : 1 grand classique, 2 établie, 3 à découvrir.
- fiabilite : A (≥2 sources lues concordantes), B (une source ou connaissance solide), C (incertain). sources : 1 à 3 noms de domaine séparés par des points-virgules (uniquement des sites réellement lus, ou « connaissance »).

### zNN-millesimes.tsv (en-têtes exactes)
zone	sous_zone	couleur	millesime	qualite	apogee_debut	apogee_fin	caractere	fiabilite	sources
- sous_zone : soit une appellation du référentiel, soit un regroupement déclaré dans zNN-regroupements.tsv (utile pour les petites appellations regroupées, ex. « Côte de Nuits »). Chaque (sous_zone, couleur) doit couvrir les 21 millésimes 2005-2025 SANS trou. Couvre les appellations majeures individuellement et regroupe les petites cohérentes.
- couleur : R, B, D ou E, uniquement si produite. millesime : année sur 4 chiffres.
- qualite : entier 1 à 5 (1 difficile, 3 correct, 5 exceptionnel) pour un bon producteur, ou NC (alors fiabilité C).
- apogee_debut, apogee_fin : années de la fenêtre de plénitude d'un bon producteur. Appuie-toi sur des données lues si possible ; sinon modélise raisonnablement selon le type de vin et la qualité (c'est accepté, mais écris-le dans ton rapport). Un vin déjà passé : indique la vraie fenêtre. NC si inconnu.
- caractere : 12 mots maximum, rédigés par toi, décrivant le millésime (météo, style).
- fiabilite : A, B ou C comme ci-dessus. sources : domaines réellement lus, ou « connaissance ».

### zNN-regroupements.tsv (en-têtes exactes)
regroupement	appellations
(une ligne par regroupement utilisé ; appellations séparées par des points-virgules, toutes présentes dans le référentiel de la zone ; fichier avec seulement l'en-tête si aucun regroupement)

## Contrôle obligatoire avant de rendre
Pour valider ta zone seule, copie tes trois fichiers dans un dossier temporaire avec une structure `data/` contenant `valider.py` et les fichiers renommés sans le préfixe zNN-, ou plus simplement lis le code de `/home/claude/carnet-/data/valider.py` et vérifie chaque règle toi-même par script (python3). Corrige jusqu'à zéro erreur (les avertissements sur des « proches » hors de ta zone sont acceptés).

## Rapport final (en réponse, 250 mots maximum)
Nombre de lignes par fichier, part A/B/C, liste des sites réellement lus avec succès et des sites illisibles, désaccords trouvés entre sources et comment tu les as tranchés, 10 lignes les plus douteuses, et indique que les fenêtres d'apogée sont modélisées là où tu les as modélisées. Aucune invention : mieux vaut NC avec fiabilité C.

## Leçons de la vérification indépendante de la zone 1 (à appliquer)
- Note la QUALITÉ du vin, jamais la quantité récoltée : une petite récolte de grande qualité (ex. Sauternes 2021, blancs de Pessac-Léognan 2013) n'est pas un millésime « difficile ». Mentionne la rareté dans `caractere`.
- Différencie les appellations quand les sources le font (ex. en 2015 Margaux se distingue et Saint-Estèphe est en retrait ; en 2019 et 2022 Margaux est plus inégal que Pauillac). Ne recopie pas la même note et le même `caractere` sur toutes les sous-zones.
- Les liquoreux ont leur propre logique (botrytis, rendement) : cherche des sources dédiées, car les moyennes de région sont trompeuses.
- Évite « connaissance » comme unique source pour les lignes que tu peux sourcer ; cite le domaine réellement lu. Une ligne reste B si elle ne repose que sur ta connaissance, mais cherche à la sourcer.
- Les critiques anglo-saxons (Decanter, Jancis Robinson, The Wine Cellar Insider, Wine Spectator) et les sites français (Hachette, Idealwine, Comptoir des Millésimes, LPV, interprofessions) peuvent diverger : signale-le et tranche par un troisième avis.
