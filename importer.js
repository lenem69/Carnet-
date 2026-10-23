// Import Excel / CSV : reconnaissance des colonnes, nettoyage, fusion des doublons.
import { norm, num } from './util.js';
import { normalizeWine, keyOf } from './logic.js';
import { reconnaitre } from './chiffres.js';

// L'ordre compte : chaque colonne prend le premier champ qui lui correspond et qui n'est pas déjà pris.
export const FIELDS = [
  ['dom', /domaine|producteur|chateau|proprietaire|proprio|maison/],
  ['name', /^nom( |$)|cuvee|^vin$|^vin |name|wine|libelle|designation/],
  ['year', /millesime|annee|year|vintage/],
  ['color', /couleur|type|color/],
  ['region', /appellation|aoc|aop|region/],
  ['grape', /cepage|grape/],
  ['qty', /quant|qte|^nb|nombre|stock|bouteilles|^q( |$)|dispo/],
  ['effervescent', /effervescent|bulle|petillant/],
  ['format', /^format|contenance|taille/],
  ['price', /prix|price|cout|tarif/],
  ['loc', /empl|casier|^loc|rang|rangement/],
  ['from', /debut|partir|^from|apogee debut/],
  ['to', /^fin|jusqu|^to$|apogee fin|limite/],
  ['check', /confiance|verifier|fiabilite/],
  ['story', /histoire|story|description/],
  ['pairings', /accord|pairing/],
  ['note', /^(mes )?notes?$|remarque|commentaire/],
];

export function mapHeaders(headers) {
  const map = {}; const used = new Set();
  // Si une colonne « Appellation » existe, « Région » (Alsace, Beaujolais…) est une zone géographique : elle n'est pas lue.
  const avecAppellation = headers.some(h => /appellation|aoc|aop/.test(norm(h)));
  for (const h of headers) {
    const n = norm(h);
    if (!n) continue;
    if (avecAppellation && /region/.test(n) && !/appellation/.test(n)) continue;
    // Une colonne de commentaires (« commentaires domaine », « notes… ») n'est jamais le nom du domaine ou du vin.
    const commentaire = /commentaire|remarque|notes?\b/.test(n);
    for (const [f, re] of FIELDS) {
      if (commentaire && f !== 'note') continue;
      if (!used.has(f) && re.test(n)) { map[h] = f; used.add(f); break; }
    }
  }
  return map;
}

const DOUBT = /moyen|faible|basse|low|medium|\?|verif/;

// rows : tableau d'objets {entête: valeur}. existing : vins déjà en cave.
// mode : 'sum' (défaut) additionne la quantité des vins déjà en cave ; 'skip' ne touche pas aux vins déjà en cave.
// Renvoie { added, updated, merged, skipped, existing, fields } sans rien modifier en dehors.
// existing = nombre de lignes du fichier qui correspondent à un vin déjà en cave.
export function rowsToWines(rows, existing, mode = 'sum') {
  // Chaque feuille peut avoir ses propres en-têtes : la correspondance se fait par jeu d'en-têtes.
  const maps = new Map();
  const mapFor = r => {
    const cle = Object.keys(r).join('\u0001');
    if (!maps.has(cle)) maps.set(cle, mapHeaders(Object.keys(r)));
    return maps.get(cle);
  };
  const fields = [...new Set(rows.slice(0, 1).flatMap(r => Object.values(mapFor(r))))];
  const byKey = new Map(existing.map(w => [keyOf(w), { w, isNew: false }]));
  const added = []; const updated = new Map(); let merged = 0; let skipped = 0; let hits = 0;
  for (const r of rows) {
    const raw = {};
    const map = mapFor(r);
    for (const h in map) { const v = r[h]; if (v !== '' && v !== null && v !== undefined) raw[map[h]] = v; }
    if (!raw.name && !raw.dom) { if (Object.values(r).some(v => String(v ?? '').trim())) skipped++; continue; }
    raw.check = DOUBT.test(norm(raw.check || ''));
    // Effervescent « Oui » : la couleur devient Pétillant. Format différent de 75 cl : ajouté au nom.
    if (/^oui|^yes|^vrai|^x$/.test(norm(raw.effervescent || ''))) raw.color = 'Pétillant';
    const fmt = String(raw.format || '').trim();
    if (fmt && norm(fmt).replace(/\s/g, '') !== '75cl' && (raw.name || raw.dom)) raw.name = `${raw.name || raw.dom} (${fmt})`;
    if (raw.qty !== undefined && num(raw.qty) === '') raw.qty = 1;
    const w = normalizeWine(raw);
    if (!w) { skipped++; continue; }
    const k = keyOf(w);
    const e = byKey.get(k);
    if (e) {
      if (!e.isNew) { hits++; if (mode === 'skip') continue; }
      // copie de l'existant (jamais modifié directement), puis cumul des quantités
      if (!e.isNew && !updated.has(e.w.id)) { e.w = JSON.parse(JSON.stringify(e.w)); updated.set(e.w.id, e.w); }
      e.w.qty += w.qty;
      e.w.updated = Date.now();
      merged++;
    } else {
      added.push(w); byKey.set(k, { w, isNew: true });
    }
  }
  return { added, updated: [...updated.values()], merged, skipped, existing: hits, fields };
}

// Lecture du fichier (nécessite le lecteur Excel embarqué, chargé à la demande).
let xlsxLoading = null;
export function loadXlsx() {
  if (self.XLSX) return Promise.resolve(self.XLSX);
  if (!xlsxLoading) {
    xlsxLoading = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'xlsx.min.js';
      s.onload = () => self.XLSX ? resolve(self.XLSX) : reject(new Error('Lecteur Excel invalide'));
      s.onerror = () => { xlsxLoading = null; reject(new Error('Lecteur Excel introuvable')); };
      document.head.appendChild(s);
    });
  }
  return xlsxLoading;
}

export async function readRows(file) {
  const XLSX = await loadXlsx();
  const buf = await file.arrayBuffer();
  let wb;
  if (/\.(csv|tsv|txt)$/i.test(file.name || '')) {
    let text;
    try { text = new TextDecoder('utf-8', { fatal: true }).decode(buf); }
    catch (e) { text = new TextDecoder('windows-1252').decode(buf); }
    text = text.replace(/^﻿/, '');
    wb = XLSX.read(text, { type: 'string', raw: true });
  } else {
    wb = XLSX.read(buf, { type: 'array' });
  }
  // Toutes les feuilles sont lues (une cave peut être découpée par couleur ou par région).
  const out = [];
  for (const nom of wb.SheetNames) {
    const sheet = wb.Sheets[nom];
    if (!sheet) continue;
    const aoa = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: true });
    const hi = ligneEntetes(aoa);
    if (hi < 0) continue; // feuille sans tableau reconnu (notes, conditions…)
    const entetes = aoa[hi].map(c => String(c ?? '').trim());
    const colonnes = Object.values(mapHeaders(entetes));
    if (colonnes.includes('name') || colonnes.includes('dom')) {
      // Tableau à en-têtes reconnus : une ligne par vin.
      for (const r of aoa.slice(hi + 1)) {
        const o = {};
        entetes.forEach((h, i) => { if (h) o[h] = r[i] ?? ''; });
        if (Object.values(o).some(v => String(v).trim() !== '')) out.push(o);
      }
    } else {
      out.push(...lireFeuilleLibre(aoa.slice(hi + 1), nom));
    }
  }
  return out;
}

// Ligne qui sert d'en-tête : celle qui reconnaît le plus de colonnes (parmi les 6 premières lignes).
function ligneEntetes(aoa) {
  let best = -1; let meilleur = 1;
  for (let i = 0; i < Math.min(aoa.length, 6); i++) {
    const n = Object.keys(mapHeaders(aoa[i].map(c => String(c ?? '').trim()))).length;
    if (n > meilleur) { best = i; meilleur = n; }
  }
  return best;
}

const COULEURS_TITRE = [[/^rouge/, 'Rouge'], [/^blanc/, 'Blanc'], [/^ros[eé]/, 'Rosé'], [/^(petillant|effervescent|mousseux|champagne)/, 'Pétillant']];
const FEUILLE_GENERIQUE = /transport|paiement|feuille|sheet|info|contact|mode d|conditions/;

// Ligne de titre de section (« ROUGE 75cl ») : une seule cellule de texte qui commence par une couleur.
function couleurDeTitre(cellules) {
  if (cellules.length !== 1 || typeof cellules[0] !== 'string') return null;
  const n = norm(cellules[0]);
  for (const [re, c] of COULEURS_TITRE) if (re.test(n)) return c;
  return null;
}

// Tableau sans en-têtes reconnus (ex. liste de caviste) : chaque ligne est lue selon son contenu.
// Ordre habituel : [prix] [région] [domaine et cuvée] [millésime] [quantité] [commentaires].
// Les lignes reçoivent la mention « faible » : elles apparaissent « à vérifier ».
export function lireFeuilleLibre(lignes, nomFeuille) {
  const sortie = []; let couleur = '';
  const region0 = FEUILLE_GENERIQUE.test(norm(nomFeuille)) ? '' : nomFeuille.trim();
  for (const r of lignes) {
    const cel = r.map(c => (typeof c === 'string' ? c.trim() : c))
      .filter(c => c !== '' && c !== null && c !== undefined && !/^x$/i.test(String(c)) && !/^tva/i.test(String(c)));
    if (!cel.length) continue;
    const c0 = couleurDeTitre(cel);
    if (c0) { couleur = c0; continue; }
    // Premier bloc de textes contigu : région et/ou domaine et cuvée.
    const debut = cel.findIndex(c => typeof c === 'string');
    if (debut < 0) continue;
    let fin = debut;
    while (fin < cel.length && typeof cel[fin] === 'string') fin++;
    // Un texte très long est un commentaire, pas un nom.
    const textes = cel.slice(debut, fin).filter(t => t.length <= 90 && !/^(tarif|millesime|quant|q |commentaire|notes?|prix)/i.test(norm(t)));
    if (!textes.length) continue;
    const nombres = cel.filter(c => typeof c === 'number');
    const annee = nombres.find(n => Number.isInteger(n) && n >= 1900 && n <= 2035);
    const prix = cel.slice(0, debut).find(c => typeof c === 'number' && c >= 5 && c !== annee);
    const apres = cel.slice(fin).filter(c => typeof c === 'number' && c !== annee && c !== prix);
    const qte = apres.find(n => Number.isInteger(n) && n > 0 && n < 1000);
    // La région est le texte reconnu comme appellation ; sinon le plus court des deux. Le nom est l'autre texte.
    const appel = textes.filter(t => reconnaitre(String(t)) !== null);
    let nom; let region;
    if (textes.length > 1 && appel.length === 1) {
      region = String(appel[0]);
      nom = String(textes.find(t => t !== appel[0]));
    } else {
      const tries = [...textes].sort((a, b) => String(b).length - String(a).length);
      nom = String(tries[0]);
      region = tries.length > 1 ? String(tries[tries.length - 1]) : region0;
    }
    const o = { Nom: nom, Région: region, Couleur: couleur, Millésime: annee ?? '', Prix: prix ?? '', Quantité: qte ?? '', Confiance: 'faible' };
    sortie.push(o);
  }
  return sortie;
}
