// Générateur de QR code (1.44.0) : sans dépendance, sans réseau, tout se calcule sur le téléphone.
// Mode octets (UTF-8), niveau de correction M, versions 1 à 10 (jusqu'à 213 octets). Vérifié par décodage dans tests/e40.mjs.
const ECC_PAR_BLOC = [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26];   // niveau M, index = version
const NB_BLOCS = [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5];                   // niveau M, index = version

const taille = v => 17 + 4 * v;
function modulesBruts(v) {
  let r = (16 * v + 128) * v + 64;
  if (v >= 2) { const n = Math.floor(v / 7) + 2; r -= (25 * n - 10) * n - 55; if (v >= 7) r -= 36; }
  return r;
}
const motsDonnees = v => Math.floor(modulesBruts(v) / 8) - ECC_PAR_BLOC[v] * NB_BLOCS[v];

/* ---------- Reed-Solomon dans GF(256), polynôme 0x11D ---------- */
function gfMul(x, y) { let z = 0; for (let i = 7; i >= 0; i--) { z = (z << 1) ^ ((z >>> 7) * 0x11D); z ^= ((y >>> i) & 1) * x; } return z & 255; }
function diviseurRS(deg) {
  const r = new Array(deg).fill(0); r[deg - 1] = 1;
  let racine = 1;
  for (let i = 0; i < deg; i++) {
    for (let j = 0; j < deg; j++) { r[j] = gfMul(r[j], racine); if (j + 1 < deg) r[j] ^= r[j + 1]; }
    racine = gfMul(racine, 2);
  }
  return r;
}
function resteRS(data, div) {
  const r = new Array(div.length).fill(0);
  for (const b of data) {
    const f = b ^ r.shift(); r.push(0);
    div.forEach((c, i) => { r[i] ^= gfMul(c, f); });
  }
  return r;
}

/* ---------- Mots de code ---------- */
function octets(texte) { return [...new TextEncoder().encode(texte)]; }
function choisirVersion(n) {
  for (let v = 1; v <= 10; v++) {
    const bitsCompte = v <= 9 ? 8 : 16;
    if (4 + bitsCompte + 8 * n <= motsDonnees(v) * 8) return v;
  }
  return 0;
}
function motsDeCode(data, v) {
  const bits = [];
  const pousse = (val, n) => { for (let i = n - 1; i >= 0; i--) bits.push((val >>> i) & 1); };
  pousse(4, 4); pousse(data.length, v <= 9 ? 8 : 16); data.forEach(b => pousse(b, 8));
  const cap = motsDonnees(v) * 8;
  pousse(0, Math.min(4, cap - bits.length));
  while (bits.length % 8) bits.push(0);
  for (let pad = 0xEC; bits.length < cap; pad ^= 0xEC ^ 0x11) pousse(pad, 8);
  const mots = []; for (let i = 0; i < bits.length; i += 8) mots.push(parseInt(bits.slice(i, i + 8).join(''), 2));
  // Blocs, correction d'erreurs, entrelacement.
  const nb = NB_BLOCS[v], ecc = ECC_PAR_BLOC[v], brut = Math.floor(modulesBruts(v) / 8);
  const courts = nb - (brut % nb), lenCourt = Math.floor(brut / nb);
  const div = diviseurRS(ecc), blocs = [];
  for (let i = 0, k = 0; i < nb; i++) {
    const len = lenCourt - ecc + (i < courts ? 0 : 1);
    const d = mots.slice(k, k + len); k += len;
    blocs.push({ d, e: resteRS(d, div) });
  }
  const out = [];
  for (let i = 0; i < blocs[nb - 1].d.length; i++) blocs.forEach(b => { if (i < b.d.length) out.push(b.d[i]); });
  for (let i = 0; i < ecc; i++) blocs.forEach(b => out.push(b.e[i]));
  return out;
}

/* ---------- Matrice ---------- */
function positionsAlignement(v) {
  if (v === 1) return [];
  const n = Math.floor(v / 7) + 2, pas = Math.ceil((v * 4 + 4) / (n * 2 - 2)) * 2, t = taille(v), r = [6];
  for (let pos = t - 7; r.length < n; pos -= pas) r.splice(1, 0, pos);
  return r;
}
function bch(val, gen, deg) { let r = val << deg; const g = 32 - Math.clz32(gen); for (let i = 31 - Math.clz32(r || 1); i >= g - 1; i--) if ((r >>> i) & 1) r ^= gen << (i - (g - 1)); return r; }

function construire(mots, v, masque) {
  const t = taille(v);
  const m = Array.from({ length: t }, () => new Array(t).fill(false));
  const f = Array.from({ length: t }, () => new Array(t).fill(false));   // modules « fonction » (jamais masqués)
  const poser = (x, y, noir) => { if (x < 0 || y < 0 || x >= t || y >= t) return; m[y][x] = noir; f[y][x] = true; };
  // Motifs de repérage et séparateurs
  for (const [cx, cy] of [[3, 3], [t - 4, 3], [3, t - 4]]) {
    for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) { const d = Math.max(Math.abs(dx), Math.abs(dy)); poser(cx + dx, cy + dy, d !== 2 && d !== 4); }
  }
  // Alignement
  const al = positionsAlignement(v);
  al.forEach((ax, i) => al.forEach((ay, j) => {
    if ((i === 0 && j === 0) || (i === 0 && j === al.length - 1) || (i === al.length - 1 && j === 0)) return;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) poser(ax + dx, ay + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
  }));
  // Synchronisation
  for (let i = 0; i < t; i++) { if (!f[i][6]) poser(6, i, i % 2 === 0); if (!f[6][i]) poser(i, 6, i % 2 === 0); }
  // Format (niveau M = 0b00) et version
  const fmt = (((0 << 3) | masque) << 10 | bch((0 << 3) | masque, 0x537, 10)) ^ 0x5412;
  const bit = (x, i) => ((x >>> i) & 1) !== 0;
  for (let i = 0; i <= 5; i++) poser(8, i, bit(fmt, i));
  poser(8, 7, bit(fmt, 6)); poser(8, 8, bit(fmt, 7)); poser(7, 8, bit(fmt, 8));
  for (let i = 9; i < 15; i++) poser(14 - i, 8, bit(fmt, i));
  for (let i = 0; i < 8; i++) poser(t - 1 - i, 8, bit(fmt, i));
  for (let i = 8; i < 15; i++) poser(8, t - 15 + i, bit(fmt, i));
  poser(8, t - 8, true);
  if (v >= 7) {
    const ver = (v << 12) | bch(v, 0x1F25, 12);
    for (let i = 0; i < 18; i++) { const b = bit(ver, i), a = t - 11 + (i % 3), c = Math.floor(i / 3); poser(a, c, b); poser(c, a, b); }
  }
  // Données en zigzag, avec le masque
  let k = 0;
  for (let droite = t - 1; droite >= 1; droite -= 2) {
    if (droite === 6) droite = 5;
    for (let vert = 0; vert < t; vert++) for (let j = 0; j < 2; j++) {
      const x = droite - j, haut = ((droite + 1) & 2) === 0, y = haut ? t - 1 - vert : vert;
      if (f[y][x] || k >= mots.length * 8) continue;
      m[y][x] = ((mots[k >>> 3] >>> (7 - (k & 7))) & 1) !== 0; k++;
    }
  }
  const test = [(x, y) => (x + y) % 2 === 0, (x, y) => y % 2 === 0, (x, y) => x % 3 === 0, (x, y) => (x + y) % 3 === 0,
    (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0, (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
    (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0, (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0][masque];
  for (let y = 0; y < t; y++) for (let x = 0; x < t; x++) if (!f[y][x] && test(x, y)) m[y][x] = !m[y][x];
  return m;
}

function penalite(m) {
  const t = m.length; let p = 0;
  const ligne = (get) => {
    for (let a = 0; a < t; a++) {
      let run = 1;
      for (let b = 1; b < t; b++) { if (get(a, b) === get(a, b - 1)) { run++; if (run === 5) p += 3; else if (run > 5) p++; } else run = 1; }
      // motif 1:1:3:1:1 entouré de blanc
      for (let b = 0; b + 10 < t + 0; b++) {
        const s = []; for (let i = 0; i < 11; i++) s.push(get(a, b + i) ? 1 : 0);
        const j = s.join('');
        if (j === '10111010000' || j === '00001011101') p += 40;
      }
    }
  };
  ligne((y, x) => m[y][x]); ligne((x, y) => m[y][x]);
  for (let y = 0; y < t - 1; y++) for (let x = 0; x < t - 1; x++) { const c = m[y][x]; if (c === m[y][x + 1] && c === m[y + 1][x] && c === m[y + 1][x + 1]) p += 3; }
  let noirs = 0; for (const r of m) for (const c of r) if (c) noirs++;
  p += Math.floor(Math.abs(noirs * 20 - t * t * 10) / (t * t)) * 10;
  return p;
}

// Matrice booléenne (true = module noir) pour un texte ; null si le texte est trop long (213 octets au plus).
export function qrMatrice(texte) {
  const data = octets(String(texte));
  const v = choisirVersion(data.length);
  if (!v) return null;
  const mots = motsDeCode(data, v);
  let meilleur = null, score = Infinity;
  for (let mk = 0; mk < 8; mk++) { const m = construire(mots, v, mk); const s = penalite(m); if (s < score) { score = s; meilleur = m; } }
  return meilleur;
}

// SVG prêt à afficher : fond blanc, marge de 4 modules, modules noirs en un seul tracé.
export function qrSvg(texte, { couleur = '#2a1d20', label = 'QR code' } = {}) {
  const m = qrMatrice(texte);
  if (!m) return '';
  const t = m.length, q = 4;
  let d = '';
  for (let y = 0; y < t; y++) for (let x = 0; x < t; x++) if (m[y][x]) d += `M${x + q} ${y + q}h1v1h-1z`;
  const n = t + 2 * q;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n} ${n}" shape-rendering="crispEdges" role="img" aria-label="${label}"><rect width="${n}" height="${n}" fill="#fff"/><path d="${d}" fill="${couleur}"/></svg>`;
}
