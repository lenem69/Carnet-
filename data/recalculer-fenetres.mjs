// Recalcule apogee_debut / apogee_fin de data/zones/zNN-millesimes.tsv à partir de la note du millésime et des règles de apogee.js.
// Les lignes de regroupement (ex. « Médoc et Haut-Médoc ») prennent l'enveloppe des fenêtres de leurs membres.
// Usage : node data/recalculer-fenetres.mjs   (puis python3 data/assembler.py, python3 data/build-bible.py, node data/etendre-regroupements.mjs)
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
import { fenetreGarde } from '../apogee.js';
const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'zones');
const COL = { R: 'Rouge', B: 'Blanc', D: 'Blanc', E: 'Pétillant' }; // D = doux : rangé avec les blancs, comme dans l'appli
const groupes = {};
for (const f of fs.readdirSync(dir).filter(f => /^z\d\d-regroupements\.tsv$/.test(f)))
  for (const l of fs.readFileSync(path.join(dir, f), 'utf8').split('\n').slice(1)) {
    if (!l.trim()) continue; const [g, apps] = l.split('\t'); groupes[g] = apps.split(';').map(s => s.trim()).filter(Boolean);
  }
let changees = 0;
for (const f of fs.readdirSync(dir).filter(f => /^z\d\d-millesimes\.tsv$/.test(f)).sort()) {
  const p = path.join(dir, f);
  const lines = fs.readFileSync(p, 'utf8').split('\n');
  const H = lines[0].split('\t'); const I = n => H.indexOf(n);
  const out = [lines[0]];
  for (const l of lines.slice(1)) {
    if (!l.trim()) { out.push(l); continue; }
    const c = l.split('\t');
    if (c[I('apogee_debut')] === 'NC' || !COL[c[I('couleur')]]) { out.push(l); continue; }
    const name = c[I('sous_zone')], color = COL[c[I('couleur')]], year = Number(c[I('millesime')]), q = Number(c[I('qualite')]);
    const un = n => fenetreGarde({ name: n, dom: '', region: n, color, year }, q);
    let g;
    if (groupes[name]) { const fen = groupes[name].map(un).filter(Boolean); g = { from: Math.min(...fen.map(x => x.from)), to: Math.max(...fen.map(x => x.to)) }; }
    else g = un(name);
    if (g && (String(g.from) !== c[I('apogee_debut')] || String(g.to) !== c[I('apogee_fin')])) { changees++; c[I('apogee_debut')] = String(g.from); c[I('apogee_fin')] = String(g.to); }
    out.push(c.join('\t'));
  }
  fs.writeFileSync(p, out.join('\n'));
}
console.log('fenêtres recalculées :', changees);
