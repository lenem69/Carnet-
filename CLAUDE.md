# Ma cave : consignes pour Claude

Appli personnelle de suivi de cave à vin (PWA hors connexion), utilisée sur un téléphone Android.
Hébergée par GitHub Pages depuis la branche `main`, racine du dépôt : **tout push sur `main` est publié**.
Utilisateur : francophone, veut des réponses directes et des corrections complètes. Interface 100 % en français.

## Principes non négociables
- **Données uniquement sur le téléphone** (IndexedDB). Jamais de données, sauvegardes, tableurs de cave ni clés d’IA dans le dépôt (public).
- **L’appli fonctionne sans IA et hors connexion.** L’IA (ai.js) est optionnelle, appelée seulement sur action explicite, avec clé saisie par l’utilisateur.
- **Aucune dépendance externe au chargement** : pas de CDN, pas de police web. Le lecteur Excel est embarqué (`xlsx.min.js`, SheetJS 0.18.5, licence Apache-2.0).
- **Discrétion** : garder `<meta name="robots" content="noindex…">` et `<meta name="referrer" content="no-referrer">` dans index.html.
- **Jamais d’échec silencieux** : toute erreur est expliquée à l’utilisateur ; jamais de message de succès si l’enregistrement a échoué.

## Structure (fichiers à plat, à la racine)
- `index.html`, `styles.css` : interface (feuilles qui montent du bas, bouton + flottant).
- `app.js` : interface et enchaînements. `logic.js` : règles métier pures (fiches, garde, accords sans IA, CSV, sauvegardes).
- `store.js` : IndexedDB (repli en mémoire si refusé). `importer.js` : import Excel/CSV. `files.js` : partage/téléchargement.
- `ai.js` : Gemini (défaut), Claude, compatible OpenAI ; nouvel essai auto sur limite par minute ; prompts métier.
- `sw.js` : hors connexion + mises à jour. `version.js` : **numéro de version unique** (lu par la page et le service worker).
- `tests/` : tests unitaires et navigateur (non chargés par l’appli).

## Procédure pour toute modification
1. Lire le code concerné ; garder le style existant (modules ES, pas de framework, pas d’étape de build).
2. Modifier. Si un fichier est ajouté à l’appli : l’ajouter à la liste `FILES` de `sw.js`.
3. Si le format des fiches change : faire évoluer `normalizeWine` et `SCHEMA_VERSION` (logic.js) pour migrer les anciennes données, et garder `parseBackup` compatible avec les anciennes sauvegardes (v1 et v2).
4. **Augmenter la version** dans `version.js` (1.0.0 → 1.0.1 correctif, 1.1.0 fonction). Sans cela, le téléphone ne voit pas la mise à jour.
5. Ajouter ou adapter les tests, puis : `cd tests && npm install && npm test` → **0 échec exigé** avant tout push.
6. Commit clair en français, push sur `main`. Dire à l’utilisateur : ouvrir l’appli, toucher « Mettre à jour » sur le bandeau, après une sauvegarde par précaution.

## Tests
- `tests/run-all.mjs` lance `unit.mjs` puis `e1`…`e6` (Chromium : `CHROME_PATH`, sinon `/opt/pw-browsers/chromium`, sinon `@sparticuz/chromium`).
- Le serveur de test imite GitHub Pages (sous-dossier `/cave/`, `Cache-Control: max-age=600`).
- Les appels d’IA sont simulés dans le navigateur (aucun appel réel, aucune clé).
- Couvrent : saisie, doublons, suppression/annulation, retour Android, petit écran, 1000 vins, import, export, sauvegarde/restauration, panne de stockage, migration, contenu malveillant, hors connexion, mise à jour de version, IA (erreurs, limites, arrêt, fournisseurs), discrétion.

## Pièges déjà rencontrés
- Objets figés venant d’un stockage : toujours copier avant de modifier.
- Bouton « Enregistrer » hors écran sur long formulaire : pied de fenêtre fixe + ajustement au clavier (`visualViewport`).
- Cache HTTP de l’hébergeur masquant les nouvelles versions : `register('sw.js', { updateViaCache: 'none' })` et `fetch(..., { cache: 'reload' })` à l’installation.
- CSV en Windows-1252 : décodage UTF-8 strict puis repli.
- `alert` / `confirm` / `prompt` interdits : utiliser `ask()` (boîte de dialogue interne).
- Toasts en haut d’écran : ils peuvent recouvrir les boutons du bandeau pendant 5 s.
