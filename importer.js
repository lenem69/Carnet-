// Import Excel / CSV : reconnaissance des colonnes, nettoyage, fusion des doublons.
import { norm, num } from './util.js';
import { normalizeWine, keyOf } from './logic.js';

// L'ordre compte : chaque colonne prend le premier champ qui lui correspond et qui n'est pas déjà pris.
export const FIELDS = [
  ['dom', /domaine|producteur|chateau|proprietaire|proprio|maison/],
  ['name', /^nom|cuvee|^vin$|^vin |name|wine|libelle|designation/],
  ['year', /millesime|annee|year|vintage/],
  ['color', /couleur|type|color/],
  ['region', /region|appellation|aoc|aop/],
  ['grape', /cepage|grape/],
  ['qty', /quant|qte|^nb|nombre|stock|bouteilles/],
  ['price', /prix|price|cout/],
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
  for (const h of headers) {
    const n = norm(h);
    if (!n) continue;
    for (const [f, re] of FIELDS) {
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
  const headers = rows.length ? Object.keys(rows[0]) : [];
  const map = mapHeaders(headers);
  const fields = Object.values(map);
  const byKey = new Map(existing.map(w => [keyOf(w), { w, isNew: false }]));
  const added = []; const updated = new Map(); let merged = 0; let skipped = 0; let hits = 0;
  for (const r of rows) {
    const raw = {};
    for (const h in map) { const v = r[h]; if (v !== '' && v !== null && v !== undefined) raw[map[h]] = v; }
    if (!raw.name && !raw.dom) { if (Object.values(r).some(v => String(v ?? '').trim())) skipped++; continue; }
    raw.check = DOUBT.test(norm(raw.check || ''));
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
  const sheet = wb.Sheets[wb.SheetNames[0]];
  if (!sheet) return [];
  return XLSX.utils.sheet_to_json(sheet, { defval: '', raw: true });
}
