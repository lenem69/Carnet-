# Génère taxonomie.js (appellation → zone → grande région) depuis data/referentiel.tsv.
# Usage : python3 data/build-taxonomie.py   (à relancer après assembler.py)
import csv, json, re, unicodedata, os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GRANDE = {
    'Alsace': 'Alsace', 'Beaujolais': 'Beaujolais',
    'Bordeaux rive droite et satellites': 'Bordeaux', 'Bordeaux rive gauche': 'Bordeaux',
    'Bourgogne : Chablis, Côte chalonnaise, Mâconnais': 'Bourgogne',
    'Bourgogne : Côte de Nuits et Côte de Beaune': 'Bourgogne',
    'Champagne': 'Champagne', 'Languedoc': 'Languedoc-Roussillon', 'Roussillon': 'Languedoc-Roussillon',
    'Loire': 'Vallée de la Loire', 'Provence et Corse': 'Provence et Corse',
    'Rhône nord': 'Vallée du Rhône', 'Rhône sud': 'Vallée du Rhône',
    'Sud-Ouest, Jura, Savoie': 'Sud-Ouest, Jura, Savoie',
}
def key(s):
    s = unicodedata.normalize('NFD', s)
    s = ''.join(c for c in s if not unicodedata.combining(c)).lower()
    return re.sub(r'[^a-z0-9]', '', s)
rows = list(csv.DictReader(open(os.path.join(ROOT, 'data/referentiel.tsv'), encoding='utf-8'), delimiter='\t'))
zones = {}
for r in rows:
    z = r['zone'].strip()
    if z not in GRANDE:
        raise SystemExit('zone inconnue : ' + z)
    zones[key(r['appellation'])] = [r['appellation'].strip(), z, GRANDE[z]]
lignes = ['  ' + json.dumps(k) + ': ' + json.dumps(zones[k], ensure_ascii=False, separators=(',', ':')) + ',' for k in sorted(zones)]
js = ('// Généré par data/build-taxonomie.py : appellation (clé normalisée) → [nom, zone, grande région]. Ne pas modifier à la main.\n'
      'export const TAXONOMIE = {\n' + '\n'.join(lignes) + '\n};\n')
open(os.path.join(ROOT, 'taxonomie.js'), 'w', encoding='utf-8').write(js)
print('appellations', len(zones))
