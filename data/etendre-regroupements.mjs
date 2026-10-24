// Étend bible/bible.json : chaque ligne de regroupement (ex. « Médoc et Haut-Médoc ») devient une ligne par appellation membre,
// avec la fenêtre propre à cette appellation. L'appli cherche une appellation par son nom exact : sans cette étape,
// un Haut-Médoc ou un Sauternes ne trouvait aucune entrée. Une série propre à l'appellation (même couleur) est conservée telle quelle.
// Usage : node data/etendre-regroupements.mjs (après python3 data/build-bible.py)
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
import { fenetreGarde } from '../apogee.js';
const D = path.dirname(fileURLToPath(import.meta.url));
const bibPath = path.join(D, '..', 'bible', 'bible.json');
const bible = JSON.parse(fs.readFileSync(bibPath, 'utf8'));
const groupes = {};
for (const f of fs.readdirSync(path.join(D, 'zones')).filter(f => /^z\d\d-regroupements\.tsv$/.test(f)))
  for (const l of fs.readFileSync(path.join(D, 'zones', f), 'utf8').split('\n').slice(1)) {
    if (!l.trim()) continue; const [g, apps] = l.split('\t'); groupes[g] = apps.split(';').map(s => s.trim()).filter(Boolean);
  }
const COL = { R: 'Rouge', B: 'Blanc', D: 'Blanc', E: 'Pétillant' };
const propres = new Set(bible.rows.filter(r => !groupes[r.a]).map(r => r.a + '|' + r.c));
const rows = bible.rows.filter(r => !groupes[r.a]);
let crees = 0;
for (const r of bible.rows.filter(r => groupes[r.a])) {
  for (const m of groupes[r.a]) {
    if (propres.has(m + '|' + r.c)) continue;
    const y = {};
    for (const [an, [q, , , f]] of Object.entries(r.y)) {
      const g = fenetreGarde({ name: m, dom: '', region: m, color: COL[r.c], year: Number(an) }, q);
      if (g) y[an] = [q, g.from, g.to, f];
    }
    rows.push({ a: m, c: r.c, y }); crees++;
  }
}
rows.sort((x, y) => (x.a + x.c).localeCompare(y.a + y.c, 'fr'));
bible.rows = rows;
fs.writeFileSync(bibPath, JSON.stringify(bible));
console.log('lignes par appellation créées :', crees, '; lignes totales :', rows.length);
