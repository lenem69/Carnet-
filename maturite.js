/* Maturité d'un vin : frise de la fiche, pastille de la liste et niveau de fiabilité.
   Règles pures (aucun accès à l'écran) : tout vient de l'apogée déjà calculée par apogee.js et de la garde enregistrée.
   Quatre phases : garde (pas encore à boire), jeune (à boire, avant l'apogée), apogée, déclin (après l'apogée, y compris dépassé). */
import { refTable } from './apogee.js';

const num = v => { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : null; };

// Fenêtre { g0, a0, a1, g1 } : garde (g0 à g1) qui contient l'apogée (a0 à a1). null sans millésime ou sans fenêtre exploitable.
// La garde enregistrée (saisie, bible, IA) prime ; un côté manquant vient du calcul de l'appli. Jamais d'ordre incohérent.
export function fenetreMaturite(w, a) {
  if (!w || !a || a.sansMillesime) return null;
  const f = num(w.from), t = num(w.to);
  let g0 = f || num(a.gFrom), g1 = t || num(a.gTo);
  let a0 = num(a.from), a1 = num(a.to);
  if (!g0 || !g1 || !a0 || !a1) return null;
  if (g0 > g1) return null;
  a0 = Math.min(Math.max(a0, g0), g1); a1 = Math.min(Math.max(a1, g0), g1);
  if (a0 > a1) a1 = a0;
  if (g1 === g0) return null;
  return { g0, a0, a1, g1 };
}

// Phase de la frise où se trouve l'année donnée.
export function phase(m, annee) {
  if (!m) return null;
  if (annee < m.g0) return 'garde';
  if (annee > m.g1) return 'declin';
  if (annee < m.a0) return 'jeune';
  if (annee <= m.a1) return 'apogee';
  return 'declin';
}

// Pastille de la liste : les quatre statuts de l'appli ; la couleur suit la phase de la frise.
export function pastille(m, annee) {
  const ph = phase(m, annee);
  if (!ph) return null;
  let label, date;
  if (annee < m.g0) { label = 'À garder'; date = `à ouvrir à partir de ${m.g0}`; }
  else if (annee > m.g1) { label = 'Passé, à boire vite'; date = `fin de garde en ${m.g1}`; }
  else if (m.g1 <= annee + 1) { label = 'À boire vite'; date = `avant ${m.g1}`; }
  else { label = 'Prêt à boire'; date = `jusqu’en ${m.g1}`; }
  return { phase: ph, label, date };
}

// Fiabilité de la garde : null (rien affiché) si l'utilisateur l'a saisie ; haute si l'IA l'a confirmée ; moyenne si elle vient de la bible
// (ou d'une table de référence sûre) ; faible sinon, avec la raison. ctx : { userGarde, confirmee, entree, connue, w }.
export function fiabilite(ctx) {
  if (!ctx) return null;
  if (ctx.userGarde) return { n: 0, mot: 'garde saisie par vous', raison: '', saisie: true };
  if (ctx.confirmee) return { n: 3, mot: 'haute', raison: '' };
  if (ctx.entree) return { n: 2, mot: 'moyenne', raison: '' };
  let t = null;
  try { t = ctx.w ? refTable(ctx.w) : null; } catch (e) { t = null; }
  if (t && t.fiab === 'A') return { n: 2, mot: 'moyenne', raison: '' };
  return { n: 1, mot: 'faible', raison: ctx.connue ? 'vin absent de la bible, fenêtre estimée' : 'appellation non reconnue, fenêtre générale' };
}

export function fiabiliteHtml(f) {
  if (!f) return '';
  if (f.saisie) return `<p class="fiab">Fiabilité · <b>${f.mot}</b></p>`;
  const pts = [1, 2, 3].map(i => `<i${i <= f.n ? ' class="on"' : ''}></i>`).join('');
  return `<p class="fiab">Fiabilité <span class="pts" role="img" aria-label="${f.n} sur 3">${pts}</span> <b>${f.mot}</b>${f.raison ? ` <span class="rs">· ${f.raison}</span>` : ''}</p>`;
}

// Pastille de la liste en HTML (garde la classe « tag stp » : c'est le statut principal de la carte).
export function pastilleHtml(m, annee) {
  const p = pastille(m, annee);
  if (!p) return '';
  return `<span class="tag stp pill ph-${p.phase}"><i></i>${p.label} <s>· ${p.date}</s></span>`;
}

const rect = (x0, x1, y, h, rl, rr, cls) => {
  const w = x1 - x0; if (w <= 0) return '';
  rl = Math.min(rl, w / 2, h / 2); rr = Math.min(rr, w / 2, h / 2);
  const f = n => n.toFixed(1);
  return `<path class="${cls}" d="M${f(x0 + rl)},${y} H${f(x1 - rr)} Q${f(x1)},${y} ${f(x1)},${f(y + rr)} V${f(y + h - rr)} Q${f(x1)},${y + h} ${f(x1 - rr)},${y + h} H${f(x0 + rl)} Q${f(x0)},${y + h} ${f(x0)},${f(y + h - rl)} V${f(y + rl)} Q${f(x0)},${y} ${f(x0 + rl)},${y} Z"/>`;
};

// Frise : trois blocs unis qui se touchent (jeune, apogée, déclin), piste claire pour la période avant la garde ou après la fin ; curseur « aujourd'hui ».
export function friseSvg(m, annee) {
  if (!m) return '';
  const { g0, a0, a1, g1 } = m;
  const s = Math.min(g0, annee), e = Math.max(g1, annee), L = 10, R = 350, by = 24, bh = 14;
  const X = y => L + (y - s) / (e - s) * (R - L);
  let xs = [X(g0), X(a0), X(a1), X(g1)];
  // Apogée d'une seule année : bloc d'au moins 8 unités pour rester visible.
  let d = xs.slice();
  if (d[2] - d[1] < 8) { const c = (d[1] + d[2]) / 2; d[1] = Math.max(d[0], c - 4); d[2] = Math.min(d[3], d[1] + 8); d[1] = Math.max(d[0], d[2] - 8); }
  const out = [`<rect class="mf-piste" x="${X(s).toFixed(1)}" y="${by}" width="${(X(e) - X(s)).toFixed(1)}" height="${bh}" rx="${bh / 2}"/>`];
  out.push(rect(d[0], d[1], by, bh, 7, 4, 'mf-j'), rect(d[1], d[2], by, bh, d[1] <= d[0] ? 7 : 4, d[2] >= d[3] ? 7 : 4, 'mf-a'), rect(d[2], d[3], by, bh, d[2] <= d[0] ? 7 : 4, 7, 'mf-d'));
  const xn = X(annee), cy = by + bh / 2, anc = xn < 46 ? 'start' : xn > 314 ? 'end' : 'middle';
  out.push(`<text class="au" x="${xn.toFixed(1)}" y="${by - 9}" text-anchor="${anc}">aujourd’hui</text><circle class="mf-now" cx="${xn.toFixed(1)}" cy="${cy}" r="8"/>`);
  // Dates sous les frontières ; une même année n'est écrite qu'une fois ; deuxième rangée quand deux dates se chevauchent.
  const bornes = [];
  [[g0, 'start', 0, xs[0] + 0.5], [a0, 'middle', 1, xs[1]], [a1, 'middle', 1, xs[2]], [g1, 'end', 0, xs[3] - 0.5]].forEach(([y, an, ap, x]) => {
    const prev = bornes.find(b => b.y === y);
    if (prev) { prev.ap = prev.ap || ap; return; }
    bornes.push({ y, an, ap, x });
  });
  const occ = {}; let maxr = 0; const W = 34;
  for (const b of bornes) {
    const ext = b.an === 'start' ? [b.x, b.x + W] : b.an === 'middle' ? [b.x - W / 2, b.x + W / 2] : [b.x - W, b.x];
    let r = 0;
    while ((occ[r] || []).some(([p, q]) => !(ext[1] + 6 < p || ext[0] - 6 > q))) r++;
    (occ[r] = occ[r] || []).push(ext); maxr = Math.max(maxr, r);
    out.push(`<line class="mf-tick" x1="${b.x.toFixed(1)}" y1="${by + bh + 2}" x2="${b.x.toFixed(1)}" y2="${by + bh + 6 + r * 15}"/><text class="d${b.ap ? ' dk' : ''}" x="${b.x.toFixed(1)}" y="${by + bh + 19 + r * 15}" text-anchor="${b.an}">${b.y}</text>`);
  }
  const h = by + bh + 26 + maxr * 15;
  const label = `Garde de ${g0} à ${g1}, apogée de ${a0} à ${a1}, aujourd’hui ${annee}`;
  return `<div class="mat2"><svg viewBox="0 0 360 ${h}" role="img" aria-label="${label}">${out.join('')}</svg></div>`;
}
