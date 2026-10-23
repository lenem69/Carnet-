#!/usr/bin/env python3
"""Fusionne data/zones/zNN-*.tsv en data/referentiel.tsv, data/millesimes.tsv et data/regroupements.tsv, puis lance le contrôle."""
import glob, os, subprocess, sys
D = os.path.dirname(os.path.abspath(__file__))
for nom in ('referentiel', 'millesimes', 'regroupements'):
    out, head = [], None
    for p in sorted(glob.glob(os.path.join(D, 'zones', f'z[0-9][0-9]-{nom}.tsv'))):
        lines = open(p, encoding='utf-8').read().split('\n')
        head = head or lines[0]
        if lines[0] != head: print('ERREUR en-têtes différentes :', p); sys.exit(1)
        out += [l for l in lines[1:] if l.strip()]
    if head: open(os.path.join(D, f'{nom}.tsv'), 'w', encoding='utf-8').write(head + '\n' + '\n'.join(out) + '\n')
sys.exit(subprocess.call([sys.executable, os.path.join(D, 'valider.py')]))
