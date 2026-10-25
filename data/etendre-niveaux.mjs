// Complète bible/bible.json avec les niveaux de cru de Bourgogne qui n'ont pas de ligne propre :
//  - « <commune> Premier Cru » pour les communes qui ont des premiers crus (Fixin, Vougeot, Ladoix, Pernand-Vergelesses, Monthélie,
//    Auxey-Duresses, Maranges, Blagny, Rully, Mercurey, Givry, Montagny) : notes de millésime de la commune, fenêtre calculée par le moteur ;
//  - les deux grands crus sans ligne : Mazoyères-Chambertin (vendu comme Charmes-Chambertin) et La Grande Rue (voisin de La Tâche).
// Ces lignes sont dérivées, jamais sourcées : leur fiabilité est plafonnée à « B » (connaissance). L'appli retrouve de toute façon le niveau
// de cru d'un vin par son nom (apogee.js › fenetreRang) ; ces lignes servent à la note du millésime et à la passe de fond.
// Usage : node data/etendre-niveaux.mjs (après node data/etendre-regroupements.mjs)
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
import { fenetreGarde } from '../apogee.js';
const bibPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'bible', 'bible.json');
const bible = JSON.parse(fs.readFileSync(bibPath, 'utf8'));
const COL = { R: 'Rouge', B: 'Blanc', D: 'Blanc', E: 'Pétillant' };
const COMMUNES_PC = ['Fixin', 'Vougeot', 'Ladoix', 'Pernand-Vergelesses', 'Monthélie', 'Auxey-Duresses', 'Maranges', 'Blagny', 'Rully', 'Mercurey', 'Givry', 'Montagny'];
const DERIVEES = [...COMMUNES_PC.map(c => [c, c + ' Premier Cru']), ['Charmes-Chambertin', 'Mazoyères-Chambertin'], ['La Tâche', 'La Grande Rue']];
const existe = new Set(bible.rows.map(r => r.a + '|' + r.c));
const plafond = f => (f === 'A' ? 'B' : f);
let crees = 0;
for (const [source, nom] of DERIVEES) {
  for (const r of bible.rows.filter(x => x.a === source)) {
    if (existe.has(nom + '|' + r.c)) continue;
    const y = {};
    for (const [an, [q, , , f]] of Object.entries(r.y)) {
      const g = fenetreGarde({ name: nom, dom: '', region: nom, color: COL[r.c], year: Number(an) }, q);
      if (g) y[an] = [q, g.from, g.to, plafond(f)];
    }
    bible.rows.push({ a: nom, c: r.c, y }); crees++;
  }
}
bible.rows.sort((x, y) => (x.a + x.c).localeCompare(y.a + y.c, 'fr'));
fs.writeFileSync(bibPath, JSON.stringify(bible));
console.log('lignes de niveaux créées :', crees, '; lignes totales :', bible.rows.length);
