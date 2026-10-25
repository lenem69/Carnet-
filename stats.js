// Statistiques d'usage anonymes, facultatives (accord de l'utilisateur obligatoire).
// On compte des gestes (« un vin ajouté par scan »), jamais de contenu : ni nom de vin, ni clé d'IA, ni photo.
// Une fois par semaine, un récapitulatif d'une ligne est envoyé au formulaire Google du propriétaire de l'appli.
import * as store from './store.js';

// Rempli par app.js (adresse du formulaire Google de statistiques et identifiant de son champ). Vide = fonction inactive.
export const cfg = { post: '', entry: '', version: '?' };

const FIELDS = ['ouvertures', 'add_scan', 'add_photos', 'add_tableur', 'add_manuel', 'conso', 'fiches_ia', 'fiches_verif', 'quoiboire', 'plat',
  'ia_ok', 'ia_limite', 'ia_cle', 'ia_reseau', 'ia_relais', 'err_stockage', 'err_enreg', 'err_import', 'aide'];
// Les gestes qui comptent comme « jour d'activité » (l'ouverture seule ne compte pas).
const PASSIVE = new Set(['ouvertures', 'ia_ok', 'ia_limite', 'ia_cle', 'ia_reseau', 'ia_relais', 'err_stockage', 'err_enreg', 'err_import']);

const pad = n => String(n).padStart(2, '0');
export const dayKey = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export function weekKey(d = new Date()) {
  const m = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  m.setDate(m.getDate() - ((m.getDay() + 6) % 7)); // lundi de la semaine
  return dayKey(m);
}

let st = null;          // { weeks: { 'AAAA-MM-JJ': { n: {...}, d: [jours] } }, sent: [semaines] }
let consent = null;     // 'oui' | 'non' | null (pas encore demandé)
let timer = null;
let sending = false;

const empty = () => ({ weeks: {}, sent: [] });
async function meta(k) { try { return await store.getMeta(k); } catch (e) { return undefined; } }
async function setm(k, v) { try { await store.setMeta(k, v); } catch (e) { console.error('stats', e); } }

export const configured = () => !!(cfg.post && cfg.entry);
export const consentState = () => consent;

// À appeler une fois la base ouverte. `wines` = nombre de vins déjà en cave.
export async function init(wines) {
  consent = (await meta('statsConsent')) || null;
  st = (await meta('stats')) || empty();
  if (!st.weeks || !Array.isArray(st.sent)) st = empty();
  if (!(await meta('installAt'))) {
    await setm('installAt', Date.now());
    await setm('installWithWines', wines > 0);
  }
}

export async function setConsent(yes) {
  consent = yes ? 'oui' : 'non';
  await setm('statsConsent', consent);
  if (yes) {
    if (!(await meta('statsId'))) await setm('statsId', randomId());
  } else {
    st = empty(); await setm('stats', st); await setm('statsId', null);
  }
}

function randomId() {
  const a = new Uint8Array(5);
  try { crypto.getRandomValues(a); } catch (e) { for (let i = 0; i < 5; i++) a[i] = Math.floor(Math.random() * 256); }
  return [...a].map(b => b.toString(16).padStart(2, '0')).join('');
}

function save() {
  clearTimeout(timer);
  timer = setTimeout(() => { setm('stats', st); }, 400);
}

// Compte un geste. Sans accord de l'utilisateur, ne fait rien.
export function track(name, n = 1) {
  if (consent !== 'oui' || !st || !FIELDS.includes(name) || !(n > 0)) return;
  const wk = weekKey();
  const w = st.weeks[wk] || (st.weeks[wk] = { n: {}, d: [] });
  w.n[name] = (w.n[name] || 0) + n;
  if (!PASSIVE.has(name)) { const dk = dayKey(new Date()); if (!w.d.includes(dk)) w.d.push(dk); }
  save();
}

// Premier vin enregistré (pour mesurer le délai de démarrage).
export async function noteWines(count) {
  if (consent !== 'oui' || !(count > 0)) return;
  if ((await meta('firstWineAt')) || (await meta('installWithWines'))) return;
  await setm('firstWineAt', Date.now());
}

async function context(extra) {
  const installAt = await meta('installAt');
  const first = await meta('firstWineAt');
  return {
    id: await meta('statsId'),
    installWeek: installAt ? weekKey(new Date(installAt)) : weekKey(),
    premH1: installAt && first && first >= installAt ? Math.round((first - installAt) / 36e5) + 1 : 0,
    ...extra,
  };
}

// Une ligne de 29 champs séparés par « | ». L'ordre est celui lu par le tableur : ne pas le modifier sans mettre le tableur à jour.
export function line(wk, rec, c) {
  const n = rec.n || {};
  const v = k => Math.max(0, Math.round(n[k] || 0));
  return ['v1', c.id, wk, cfg.version, c.installWeek, (rec.d || []).length, v('ouvertures'), c.wines,
    v('add_scan'), v('add_photos'), v('add_tableur'), v('add_manuel'), v('conso'), v('fiches_ia'), v('fiches_verif'), v('quoiboire'), v('plat'),
    c.iaKeys, v('ia_ok'), v('ia_limite'), v('ia_cle'), v('ia_reseau'), v('ia_relais'), v('err_stockage'), v('err_enreg'), v('err_import'),
    c.daysSinceBackup, v('aide'), c.premH1].join('|');
}

// Texte exact de ce qui serait envoyé pour la semaine en cours (affiché à l'utilisateur dans les Réglages).
export async function preview(extra) {
  if (consent !== 'oui' || !st) return '';
  const wk = weekKey();
  return line(wk, st.weeks[wk] || { n: {}, d: [] }, await context(extra));
}

// Question « Appréciez-vous l'application ? » : une réponse oui/non, envoyée une seule fois, de façon anonyme (ni identifiant, ni donnée de cave).
// Indépendante de l'accord aux statistiques : c'est le geste de répondre qui l'envoie, et la fenêtre le dit.
// Envoi par un vrai formulaire dans un cadre invisible (la méthode que Google Forms accepte sans condition) ; la fin du chargement
// du cadre sert de confirmation (la réponse de Google reste illisible depuis une autre origine).
export const avisEtat = () => meta('satisfaction');
export async function avisRepondre(rep) {
  if (rep !== 'oui' && rep !== 'non') return false;
  await setm('satisfaction', { rep, date: Date.now(), sent: false, essais: 0 });
  return avisEnvoyer();
}
export function posterFormulaire(url, champ, valeur, delai = (typeof window !== 'undefined' && window.__POST_DELAI) || 15000) {
  return new Promise(resolve => {
    let fini = false;
    const nom = 'cave-envoi-' + Date.now();
    const cadre = document.createElement('iframe');
    cadre.name = nom; cadre.hidden = true; cadre.setAttribute('aria-hidden', 'true'); cadre.tabIndex = -1;
    const f = document.createElement('form');
    f.method = 'POST'; f.action = url; f.target = nom; f.hidden = true; f.acceptCharset = 'UTF-8';
    f.setAttribute('referrerpolicy', 'no-referrer');
    const i = document.createElement('input'); i.type = 'hidden'; i.name = champ; i.value = valeur; f.appendChild(i);
    const fin = ok => { if (fini) return; fini = true; clearTimeout(t); setTimeout(() => { cadre.remove(); f.remove(); }, 500); resolve(ok); };
    const t = setTimeout(() => fin(false), delai);
    let premier = true;
    cadre.addEventListener('load', () => { if (premier) { premier = false; return; } fin(true); }); // le 1er « load » est celui du cadre vide
    document.body.appendChild(cadre); document.body.appendChild(f);
    try { f.submit(); } catch (e) { fin(false); }
  });
}
// Réessaie plus tard si le réseau manquait ; renvoie une fois les réponses envoyées par l'ancienne méthode (non confirmée).
export async function avisEnvoyer() {
  const s = await meta('satisfaction');
  if (!s || !s.rep || !configured() || navigator.onLine === false) return false;
  if (s.sent && s.via === 'form') return false;
  if ((s.essais || 0) >= 6) return false; // pas d'insistance sans fin
  try {
    const installAt = await meta('installAt');
    const ligne = ['sat', s.rep, cfg.version, installAt ? weekKey(new Date(installAt)) : weekKey()].join('|');
    const ok = await posterFormulaire(cfg.post, cfg.entry, ligne);
    await setm('satisfaction', { ...s, sent: ok, via: ok ? 'form' : s.via, essais: (s.essais || 0) + 1, lastTry: Date.now() });
    return ok;
  } catch (e) { return false; }
}

// Envoie les semaines terminées pas encore envoyées, par formulaire (voir posterFormulaire). La réponse de Google reste illisible :
// sans confirmation de chargement, on réessaie à la prochaine ouverture.
export async function flush(extra) {
  if (consent !== 'oui' || !st || !configured() || sending) return 0;
  if (navigator.onLine === false) return 0;
  const cur = weekKey();
  const due = Object.keys(st.weeks).filter(k => k < cur && !st.sent.includes(k)).sort();
  if (!due.length) return 0;
  sending = true;
  let sent = 0;
  try {
    const c = await context(extra);
    for (const wk of due) {
      try {
        if (!(await posterFormulaire(cfg.post, cfg.entry, line(wk, st.weeks[wk], c)))) break;
        st.sent.push(wk); sent++;
      } catch (e) { break; }
    }
    // On ne garde que 12 semaines d'historique.
    const keep = Object.keys(st.weeks).sort().slice(-12);
    for (const k of Object.keys(st.weeks)) if (!keep.includes(k)) delete st.weeks[k];
    st.sent = st.sent.filter(k => st.weeks[k]);
    await setm('stats', st);
  } finally { sending = false; }
  return sent;
}
