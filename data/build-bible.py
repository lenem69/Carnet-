#!/usr/bin/env python3
"""Produit bible/bible.json (servi par l'appli) à partir de data/millesimes.tsv.
Seules les lignes de fiabilité A et B sont publiées ; les C ne sont jamais utilisées."""
import csv, json, os, datetime
D = os.path.dirname(os.path.abspath(__file__))
rows = {}
with open(os.path.join(D, 'millesimes.tsv'), encoding='utf-8') as f:
    for r in csv.DictReader(f, delimiter='\t'):
        if r['fiabilite'] not in ('A', 'B') or not r['qualite'].isdigit():
            continue
        if not r['apogee_debut'].isdigit() or not r['apogee_fin'].isdigit():
            continue
        k = (r['sous_zone'], r['couleur'])
        rows.setdefault(k, {})[r['millesime']] = [int(r['qualite']), int(r['apogee_debut']), int(r['apogee_fin']), r['fiabilite']]
out = {'v': 1, 'date': datetime.date.today().isoformat(),
       'rows': [{'a': a, 'c': c, 'y': dict(sorted(y.items()))} for (a, c), y in sorted(rows.items())]}
dst = os.path.join(D, '..', 'bible')
os.makedirs(dst, exist_ok=True)
with open(os.path.join(dst, 'bible.json'), 'w', encoding='utf-8') as f:
    json.dump(out, f, ensure_ascii=False, separators=(',', ':'))
print('séries', len(out['rows']), 'millésimes', sum(len(r['y']) for r in out['rows']))
