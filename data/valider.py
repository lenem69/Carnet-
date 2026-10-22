#!/usr/bin/env python3
"""Contrôle de data/referentiel.tsv et data/millesimes.tsv (python3 data/valider.py)."""
import csv, re, sys, collections, datetime, os
D = os.path.dirname(os.path.abspath(__file__))
H1 = 'zone appellation couleurs cepages style familles_gout proches prix_indicatif_eur garde_ans notoriete fiabilite sources'.split()
H2 = 'zone sous_zone couleur millesime qualite apogee_debut apogee_fin caractere fiabilite sources'.split()
FAM = set('leger-fruite elegant-frais puissant-structure rond-gourmand epice-mediterraneen mineral-tendu riche-boise aromatique-floral moelleux-liquoreux effervescent'.split())
GROUPES = {'Médoc et Haut-Médoc': ['Médoc', 'Haut-Médoc', 'Listrac-Médoc', 'Moulis-en-Médoc'], 'Sauternes-Barsac': ['Sauternes', 'Barsac']}
err, warn = [], []
def load(name, head):
    rows = []
    with open(os.path.join(D, name), encoding='utf-8') as f:
        lines = f.read().split('\n')
    if lines[0].split('\t') != head: err.append(f'{name}: en-têtes incorrectes'); return rows
    for i, l in enumerate(lines[1:], 2):
        if not l.strip(): continue
        c = l.split('\t')
        if len(c) != len(head): err.append(f'{name} l.{i}: {len(c)} colonnes'); continue
        rows.append((i, dict(zip(head, c))))
    return rows
R = load('referentiel.tsv', H1); M = load('millesimes.tsv', H2)
names = collections.Counter(r['appellation'] for _, r in R)
for n, k in names.items():
    if k > 1: err.append(f'appellation en double : {n}')
for i, r in R:
    if not set(r['couleurs'].split(',')) <= {'R', 'B', 'Ro', 'E', 'D'}: err.append(f'ref l.{i}: couleurs')
    f = r['familles_gout'].split(',')
    if not (1 <= len(f) <= 3 and set(f) <= FAM): err.append(f'ref l.{i}: familles_gout {r["familles_gout"]}')
    if not re.fullmatch(r'\d+-\d+', r['prix_indicatif_eur']) or not re.fullmatch(r'\d+-\d+', r['garde_ans']): err.append(f'ref l.{i}: prix/garde')
    if r['notoriete'] not in '123' or r['fiabilite'] not in 'ABC': err.append(f'ref l.{i}: notoriete/fiabilite')
    if len(r['style'].split()) > 12: err.append(f'ref l.{i}: style > 12 mots')
    for p in r['proches'].split(','):
        if p not in names: warn.append(f'ref {r["appellation"]}: proche « {p} » absent (zone non encore traitée ?)')
    if re.search(r'https?://|www\.', ' '.join(r.values())): err.append(f'ref l.{i}: URL')
ok_sz = set(names) | set(GROUPES)
t = datetime.date.today(); an = t.year - 1 if t.month < 11 else t.year  # dernier millésime vendangé
series = collections.defaultdict(set)
for i, r in M:
    if r['sous_zone'] not in ok_sz: err.append(f'mil l.{i}: sous_zone inconnue {r["sous_zone"]}')
    if r['couleur'] not in ('R', 'B', 'D', 'E'): err.append(f'mil l.{i}: couleur')
    if not re.fullmatch(r'20\d\d', r['millesime']): err.append(f'mil l.{i}: millésime'); continue
    series[(r['sous_zone'], r['couleur'])].add(int(r['millesime']))
    q = r['qualite']
    if q != 'NC' and q not in list('12345'): err.append(f'mil l.{i}: qualite')
    if q == 'NC' and r['fiabilite'] != 'C': err.append(f'mil l.{i}: NC sans fiabilité C')
    a, b = r['apogee_debut'], r['apogee_fin']
    if (a == 'NC') != (b == 'NC'): err.append(f'mil l.{i}: apogée incomplète')
    if a != 'NC' and (not a.isdigit() or not b.isdigit() or int(a) > int(b)): err.append(f'mil l.{i}: apogée {a}-{b}')
    if len(r['caractere'].split()) > 12: err.append(f'mil l.{i}: caractere > 12 mots')
    if r['fiabilite'] not in list('ABC'): err.append(f'mil l.{i}: fiabilite')
    if re.search(r'https?://|www\.|[«»“”]', ' '.join(r.values())): err.append(f'mil l.{i}: URL ou citation')
for k, ys in series.items():
    miss = sorted(set(range(2010, an + 1)) - ys)
    if miss: err.append(f'série {k}: millésimes manquants {miss}')
fi = collections.Counter(r['fiabilite'] for _, r in M)
tot = sum(fi.values()) or 1
print(f'référentiel : {len(R)} appellations ; millésimes : {len(M)} lignes ; fiabilité A/B/C = ' + '/'.join(f'{fi[x]*100//tot}%' for x in 'ABC'))
for w in sorted(set(warn)): print('AVERTISSEMENT', w)
for e in err: print('ERREUR', e)
sys.exit(1 if err else 0)
