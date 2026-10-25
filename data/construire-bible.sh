#!/bin/sh
# Reconstruit toute la bible à partir des fichiers de zone (data/zones/zNN-*.tsv). Depuis la racine du dépôt : sh data/construire-bible.sh
set -e
python3 data/assembler.py
node data/recalculer-fenetres.mjs
python3 data/assembler.py
python3 data/build-bible.py
node data/etendre-regroupements.mjs
node data/etendre-niveaux.mjs
