#!/usr/bin/env python3
"""Construit reperes.js : repères PAR APPELLATION (service, carafage, cépages, familles d'accords) dérivés d'un fichier de référence
fourni par l'utilisateur (TSV). Le fichier lui-même n'est JAMAIS copié dans le dépôt : seuls des agrégats (médianes, majorités, pourcentages) sont écrits,
avec le nombre de vins sur lesquels ils reposent. Aucun texte de description, aucune citation d'expert, aucun plat recopié.
Usage : python3 data/construire-reperes.py chemin/du/fichier.tsv > reperes.js
Fiabilité B (une seule source commerciale, repères d'appellation, jamais d'une cuvée)."""
import csv, sys, re, unicodedata, collections, statistics, json

def n(s):
    return re.sub(r'\s+', ' ', unicodedata.normalize('NFD', (s or '').lower().replace('’', "'")).encode('ascii', 'ignore').decode()).strip()

def cle(s):  # même règle que cle() de crus.js : sans tirets ni apostrophes
    return re.sub(r'\s+', ' ', re.sub(r"[-'’]", ' ', n(s))).strip()

ROUGES = {'pinot noir', 'gamay', 'syrah', 'grenache', 'mourvedre', 'cabernet sauvignon', 'cabernet franc', 'merlot', 'malbec', 'tannat', 'nebbiolo', 'sangiovese', 'tempranillo', 'carignan', 'cinsault', 'poulsard', 'trousseau', 'mondeuse', 'petit verdot'}
BLANCS = {'chardonnay', 'sauvignon', 'sauvignon blanc', 'chenin', 'riesling', 'aligote', 'viognier', 'marsanne', 'roussanne', 'gewurztraminer', 'pinot gris', 'melon de bourgogne', 'melon', 'petit manseng', 'gros manseng', 'jacquere', 'altesse', 'savagnin', 'muscat', 'sylvaner', 'pinot blanc', 'semillon', 'vermentino', 'albarino'}

ALIAS = {'sauvignon blanc': 'sauvignon', 'chenin blanc': 'chenin', 'melon': 'melon de bourgogne', 'gamay noir': 'gamay', 'pinot noir': 'pinot noir', 'grenache noir': 'grenache', 'syrah shiraz': 'syrah', 'riesling renano': 'riesling'}
LIBELLE = {'sauvignon': 'Sauvignon blanc', 'chenin': 'Chenin blanc'}

def cepages(txt):
    t = n(txt)
    t = re.sub(r'\d+\s*(,\d+)?\s*%', ' ', t)
    t = re.sub(r'\b(dont|etc|principalement|majoritairement|et de|complete par|assemblage|vieilles vignes)\b', ',', t)
    out = []
    for p in re.split(r'[,/;+]|\bet\b|\bavec\b', t):
        p = re.sub(r'[^a-z ]', ' ', p); p = re.sub(r'\s+', ' ', p).strip()
        p = ALIAS.get(p, p)
        if 3 <= len(p) <= 28: out.append(p)
    return out

def classe_couleur(c_txt):
    g = [x for x in cepages(c_txt)]
    if not g: return None
    r = sum(1 for x in g if x in ROUGES); b = sum(1 for x in g if x in BLANCS)
    if r and not b: return 'Rouge'
    if b and not r: return 'Blanc'
    return None

# Familles de plats : vocabulaire PROPRE (rien n'est recopié du fichier). regex → libellé + exemples génériques.
FAM = [
 ('gibier à poil', r'cerf|chevreuil|lievre|sanglier|biche|daim|civet|marcassin|gibier a poil', 'Gibier à poil (cerf, chevreuil, sanglier)'),
 ('gibier à plume', r'perdreau|faisan|pigeon|palombe|caille|grouse|becasse|canard sauvage|colvert', 'Gibier à plume (perdreau, faisan, pigeon)'),
 ('canard', r'canard|canette|magret|foie gras|confit', 'Canard et foie gras (magret, confit)'),
 ('volaille', r'poulet|volaille|poularde|chapon|dinde|coq |pintade', 'Volaille (poulet, poularde, pintade)'),
 ('agneau', r'agneau|gigot|mouton', 'Agneau (gigot, carré, épaule)'),
 ('bœuf et veau', r'boeuf|entrecote|onglet|bavette|rumsteck|tournedos|joue de boeuf|veau|bourguignon', 'Bœuf et veau (entrecôte, joue, bourguignon)'),
 ('porc', r'porc|cochon|jambon|saucisse|andouillette|lard|cassoulet|charcuterie|boudin|echine|travers', 'Porc et charcuterie (jambon, saucisse)'),
 ('poisson', r'turbot|\bbar\b|\bsole\b|saint pierre|barbue|lotte|truite|saumon|daurade|dorade|merlu|cabillaud|thon|rouget|brochet|sandre|poisson|ris de veau', 'Poissons nobles (turbot, sole, bar, saumon)'),
 ('coquillages', r'huitre|crabe|crevette|gambas|moule|palourde|oursin|coquillage|crustace|tourteau|homard|langoustine|saint jacques|st jacques|coquille', 'Crustacés et coquillages (huîtres, homard, saint-jacques)'),
 ('fromage', r'fromage|comte|roquefort|bleu|chevre|brie|epoisses|reblochon|camembert|munster|vacherin|mont d or|parmesan|pecorino|brebis|ossau|beaufort|fourme|tomme|raclette|fondue', 'Fromages (comté, chèvre, bleu, brie)'),
 ('champignons', r'truffe|cepe|girolle|morille|champignon|trompette', 'Champignons et truffe (cèpes, girolles, morilles)'),
 ('légumes', r'legume|risotto|gnocchi|asperge|artichaut|aubergine|courge|potimarron|polenta|ravioli|orecchiette|pates', 'Légumes, pâtes et risotto'),
 ('épicé', r'curry|thai|asiatique|tajine|gingembre|piment|wok|sushi|sashimi|tandoori|massala|kimchi', 'Cuisine épicée ou asiatique (curry, thaï, sushi)'),
 ('dessert', r'dessert|chocolat|tatin|creme brulee|glace|sorbet|gateau|clafoutis|crumble', 'Desserts (chocolat, tarte aux fruits)'),
 ('apéritif', r'aperitif|tapas|gougere|saumon fume|carpaccio|ceviche', 'Apéritif et entrées froides'),
]

def carafe(txt):
    t = n(txt)
    if re.search(r'longuement|long passage|longue|plusieurs heures|\b[23] ?h', t): return 'long'
    if re.search(r'carafe|decant|aerer', t): return 'carafe'
    if re.search(r'ouvrir|epauler|a l avance', t): return 'ouvrir'
    if re.search(r'en bouteille|directement|pas besoin|aucun', t): return 'direct'
    return None

def svc(txt):
    m = re.match(r'\s*(\d{1,2})(?:\s*-\s*(\d{1,2}))?', txt or '')
    if not m: return None
    lo = int(m.group(1)); hi = int(m.group(2) or lo)
    return (lo, hi) if 4 <= lo <= hi <= 20 else None

def niveau(app):
    a = n(app)
    return 'g' if re.search(r'grand cru', a) else 'p' if re.search(r'1er cru|premier cru', a) else 'v'

def base(app):
    return cle(re.sub(r'(?i)\s*(1er|premier|grand)\s+cru\b', '', app or ''))

def main(path):
    rows = list(csv.DictReader(open(path, encoding='utf-8', errors='replace'), delimiter='\t', quoting=csv.QUOTE_NONE))
    ecartes = collections.Counter()
    g = collections.defaultdict(list)
    for r in rows:
        col = r.get('couleur', '')
        if col not in ('Rouge', 'Blanc') or r.get('type') != 'Sec' or not r.get('appellation'): continue
        cc = classe_couleur(r.get('cepages', ''))
        if cc and cc != col: ecartes['couleur incohérente avec les cépages'] += 1; continue  # erreur du fichier : ligne écartée, jamais devinée
        g[(base(r['appellation']), niveau(r['appellation']), 'R' if col == 'Rouge' else 'B')].append(r)
    out = {}
    for (b, nv, c), v in g.items():
        if len(v) < 3: continue
        e = {'n': len(v)}
        s = [x for x in (svc(r['servir_a']) for r in v) if x]
        if len(s) >= 3:
            lo = round(statistics.median(x[0] for x in s)); hi = round(statistics.median(x[1] for x in s))
            mil = (lo + max(lo, hi)) / 2
            if sum(1 for x in s if abs((x[0] + x[1]) / 2 - mil) <= 1) / len(s) >= 0.6:  # repère seulement si le fichier est cohérent
                e['s'] = [lo, max(lo, hi)]
        cf = [x for x in (carafe(r['conseil_service']) for r in v) if x]
        if len(cf) >= 4:
            k, m = collections.Counter(cf).most_common(1)[0]
            if m / len(cf) >= 0.6: e['c'] = k
        # Cépage : seulement pour une appellation qui n'en admet qu'un (85 % des vins du fichier, 5 vins au moins). Un assemblage varie d'une cuvée à l'autre : jamais deviné.
        ASSEMBLAGES = ('alsace', 'cotes de castillon', 'rioja', 'vallee de maipo', 'saint emilion', 'bordeaux')  # appellations d'assemblage ou multi-cépages : jamais de cépage unique écrit
        if not b.startswith('vin de') and b not in ASSEMBLAGES and len(v) >= 5:
            cnt = collections.Counter(x for r in v for x in set(cepages(r['cepages'])) if x in ROUGES | BLANCS)
            mc = cnt.most_common(2)
                # Présence ≠ dominance : si un second cépage figure dans 25 % des vins ou plus, c'est un assemblage (Bordeaux, Châteauneuf, Côtes du Rhône) : jamais écrit.
            if mc and mc[0][1] / len(v) >= 0.85 and (len(mc) < 2 or mc[1][1] / len(v) < 0.25):
                e['g'] = [LIBELLE.get(mc[0][0], mc[0][0].capitalize())]
        if len(v) >= 5:
            cnt = collections.Counter()
            for r in v:
                t = n(r['suggestion_gourmande'])
                for k, rx, _ in FAM:
                    if re.search(rx, t): cnt[k] += 1
            top = [k for k, m in cnt.most_common(3) if m / len(v) >= 0.3]
            if top: e['a'] = top
        if len(e) > 1: out[f'{b}|{nv}|{c}'] = e
    libelles = {k: l for k, _, l in FAM}
    sys.stdout.write('// GÉNÉRÉ par data/construire-reperes.py à partir d\'un fichier de référence de l\'utilisateur (non versionné). Ne pas éditer à la main.\n'
                     '// Repères PAR APPELLATION (fiabilité B : une source commerciale, médianes et majorités). Jamais une donnée de cuvée, jamais un texte recopié.\n'
                     '// Clé : appellation sans niveau (sans tirets) | niveau (v village, p premier cru, g grand cru) | couleur (R, B).\n'
                     '// n = nombre de vins ; s = service [min, max] °C ; c = carafage ; g = cépages ; a = familles d\'accords.\n')
    sys.stdout.write('export const REPERES = ' + json.dumps(out, ensure_ascii=False, separators=(',', ':'), sort_keys=True) + ';\n')
    sys.stdout.write('export const FAMILLES = ' + json.dumps(libelles, ensure_ascii=False, separators=(',', ':')) + ';\n')
    sys.stderr.write(f'{len(out)} repères ; lignes écartées : {dict(ecartes)}\n')

main(sys.argv[1])
