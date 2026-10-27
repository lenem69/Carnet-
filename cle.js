// Activation de la clé Gemini : règles pures (nettoyage de la clé, fréquence des invitations, reprise).
// Aucune clé n'est écrite ici : ce module ne fait que nettoyer et décider.

export const CLE_MIN = 20;            // une vraie clé fait bien plus de 20 caractères
export const B_MAX = 3;               // l'encart B ne s'affiche jamais plus de 3 fois au total
export const B_PAUSE_JOURS = 14;      // pause après une fermeture par la croix
export const REPRISE_MS = 60 * 60 * 1000; // la reprise « à l'étape 2 » vaut une heure

// Nettoie ce que la personne a collé : retire espaces, sauts de ligne, guillemets et apostrophes autour.
// Retourne { cle } ou { err: 'vide' | 'incomplete' }. On ne se fie jamais au début de la clé (« AIza » ou « AQ. »).
export function nettoyerCle(brut) {
  let s = String(brut == null ? '' : brut).replace(/[​-‍﻿]/g, '').trim();
  s = s.replace(/^["'“”‘’`«»\s]+|["'“”‘’`«»\s]+$/g, '');
  if (!s) return { err: 'vide' };
  if (/\s/.test(s)) return { err: 'incomplete' };            // espace ou saut de ligne au milieu : texte recopié en partie
  if (s.length < CLE_MIN) return { err: 'incomplete' };
  if (!/^[\x21-\x7e]+$/.test(s)) return { err: 'incomplete' }; // accents, guillemets typographiques : un en-tête réseau les refuserait
  return { cle: s };
}

// Masque une clé pour l'affichage : début et fin seulement.
export function masquerCle(cle) {
  const s = String(cle || '');
  return s.length <= 8 ? '••••' : s.slice(0, 4) + '…' + s.slice(-4);
}

// État mémorisé des invitations (encart B) : { vus, dernier, ferme }. Lecture tolérante.
export function lireInvit(txt) {
  let o = null;
  try { o = JSON.parse(txt || 'null'); } catch (e) { o = null; }
  const n = v => (Number.isFinite(Number(v)) && Number(v) > 0 ? Math.floor(Number(v)) : 0);
  return { vus: n(o && o.vus), dernier: typeof (o && o.dernier) === 'string' ? o.dernier : '', ferme: n(o && o.ferme) };
}
// L'encart B peut-il s'afficher maintenant ? jour = 'AAAA-MM-JJ' du jour, now = Date.now().
export function peutAfficherB(etat, jour, now) {
  const e = etat || { vus: 0, dernier: '', ferme: 0 };
  if (e.vus >= B_MAX) return false;
  if (e.dernier === jour) return false;
  if (e.ferme && now - e.ferme < B_PAUSE_JOURS * 864e5) return false;
  return true;
}
export const noterB = (etat, jour) => ({ ...etat, vus: (etat.vus || 0) + 1, dernier: jour });
export const fermerB = (etat, now) => ({ ...etat, ferme: now });

// Étape reprise après le retour de la page de Google : { etape, t } → étape à montrer (1 par défaut).
export function lireReprise(txt, now) {
  let o = null;
  try { o = JSON.parse(txt || 'null'); } catch (e) { o = null; }
  if (o && (o.etape === 2 || o.etape === 3) && now - Number(o.t) >= 0 && now - Number(o.t) < REPRISE_MS) return o.etape;
  return 1;
}
