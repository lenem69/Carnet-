# Méthode : apogée et fenêtre de dégustation (version 1.29.2)

Une seule source de vérité : `apogee.js`. La bible (`bible/bible.json`) ne contient que des fenêtres calculées par ce code, jamais éditées à la main.

## Le calcul
1. **Pic** = millésime + années de la règle de l'appellation (table de référence A/B, sinon `PAR_APPELLATION`, sinon règle générale par couleur et région). Ces durées valent pour un **bon millésime (note 4)**.
2. **Qualité du millésime** (note 1 à 5 de la bible) : décale le pic, proportionnellement à la durée de vie du vin (note 1 : -40 %, 2 : -28 %, 3 : -12 %, 4 : 0, 5 : +10 %).
3. **Période d'apogée** = pic ± h, avec h selon la catégorie : léger (≤ 3 ans) 1, courant 2, structuré (8-11) 2, prestige (12-19) 3, longue garde (≥ 20, liquoreux) 4.
4. **Fenêtre de dégustation** = apogée élargie d'une marge avant (1 à 4 ans) et d'une marge après proportionnelle à la durée de vie (prestige 0,8 × durée, plafonnée à 12 ; structuré 0,9 × ; courant 3 à 4 ans ; léger 2), corrigée par la note du millésime (note 1 : -55 %, 2 : -45 %, 3 : -20 %, 5 : +15 % de la durée).
5. **Cohérence** : l'apogée est toujours à l'intérieur de la fenêtre (testé sur chaque millésime de la bible, `tests/unit.mjs`). Dans l'appli, `apogee(w, année, note)` reçoit la note via `bibleQuality` ; sans note, c'est la référence (note 4).

## Appellations regroupées
La bible de travail (`data/zones`) range certaines appellations sous un nom de regroupement (`regroupements.tsv`, ex. « Médoc et Haut-Médoc »). L'appli cherche une appellation par son nom exact : `etendre-regroupements.mjs` crée donc une ligne par appellation membre, avec sa propre fenêtre. Une série propre à l'appellation (même couleur) est conservée telle quelle. Dans les fichiers TSV, une ligne de regroupement porte l'enveloppe des fenêtres de ses membres.

## Reconstruire la bible
Depuis la racine du dépôt : `sh data/construire-bible.sh` (assemblage et contrôle, recalcul des fenêtres, génération du JSON, extension des regroupements). Puis `cd tests && npm test`.

## Limites connues
- Les pics sont des estimations (table Hachette A/B, connaissances de dégustation), pas des données lues ligne à ligne.
- La note du millésime est celle de la bible (fiabilité A ou B) ; une fiabilité B peut reposer sur la seule connaissance.
- Liquoreux et vins de très longue garde : aucune source trouvée pour des durées au-delà de 25 ans de fenêtre.
- Hermitage rouge : la table (fiabilité A) donne +11 ans, ce qui paraît court pour un vin de très longue garde.
