// Interface de l'appli « Ma cave ».
import { $, $$, esc, norm, num, price, uid, symPct } from './util.js';
import * as store from './store.js';
import * as L from './logic.js';
import * as AI from './ai.js';
import * as Cle from './cle.js';
import * as IMP from './importer.js';
import { saveFile, readText } from './files.js';
import * as Stats from './stats.js';
import * as Notes from './notes.js';
import { demoWines, isDemo } from './demo.js';
import { apogee, apogeeTexte, serviceTexte, carafageTexte, fenetreRang, repereVin } from './apogee.js';
import { profil, accordsRepere } from './profils.js';
import { chiffres, statutOf } from './chiffres.js';
import { fenetreMaturite, phase, pastilleHtml, friseSvg, fiabilite, fiabiliteHtml } from './maturite.js';
const STATUT_LIBELLE = { pret: 'Prêt à boire', garder: 'À garder', urgence: 'Urgence' };
import { QUOTES } from './quotes.js';

const VERSION = self.APP_VERSION || '?';
// Formulaire Google de retours (aucune adresse mail n’est publiée dans le code).
const FEEDBACK_POST = 'https://docs.google.com/forms/d/e/1FAIpQLSfOirVg2Xykiv6DvPS1jNM5NQJSpnW0ajhbdP1gD3bKap1QDw/formResponse';
// Statistiques anonymes (facultatives) : formulaire Google dédié, à renseigner une fois créé.
const STATS_POST = 'https://docs.google.com/forms/d/e/1FAIpQLScChmXM2fHOgYVgWUAmyNOrbO26o7RonBQoJ8EgzHIfYh9RUA/formResponse';
const STATS_ENTRY = 'entry.1453674659';
const STATS_RELAIS = 'https://cave-stats.m-jeanfrancois-morin.workers.dev/v1/jour';
const FEEDBACK_ENTRY = 'entry.1804718778'; // identifiant du champ « Votre message » du formulaire (entry.NNN)
const YEAR = new Date().getFullYear();
const PAGE = 100;
const BACKUP_DAYS = 60;
const S = {
  wines: [], tab: 'cave', filt: 'Tous', sort: 'name', q: '', limit: PAGE, bmode: 'year',
  editId: null, formExtra: {}, lastBackup: 0, update: null, ready: false, highlight: null, lastTab: null, ouvert: new Set(), title: 'Ma cave', bible: null,
};
const DEFAULT_TITLE = 'Ma cave';

/* ============ Messages ============ */
function toast(msg, opt = {}) {
  const box = $('#toasts');
  // un même message déjà affiché n’est pas répété
  const deja = [...box.children].find(c => c.firstChild && c.firstChild.textContent === msg);
  if (deja) return deja;
  if (opt.kind === 'err') [...box.querySelectorAll('.toast.err')].forEach(c => c.remove());
  const el = document.createElement('div');
  el.className = 'toast' + (opt.kind === 'err' ? ' err' : '');
  el.setAttribute('role', opt.kind === 'err' ? 'alert' : 'status');
  const sp = document.createElement('span'); sp.textContent = msg; el.appendChild(sp);
  if (opt.action) {
    const b = document.createElement('button'); b.className = 'tact'; b.textContent = opt.action.label;
    b.onclick = () => { el.remove(); opt.action.fn(); }; el.appendChild(b);
  }
  const x = document.createElement('button'); x.textContent = '✕'; x.setAttribute('aria-label', 'Fermer le message');
  x.onclick = () => el.remove(); el.appendChild(x);
  box.appendChild(el);
  while (box.children.length > 3) box.firstElementChild.remove();
  if (opt.kind !== 'err') setTimeout(() => el.remove(), opt.action ? 10000 : 5000);
  return el;
}
const errToast = msg => toast('⚠️ ' + msg, { kind: 'err' });
// Erreur de clé ou de modèle d’IA : un bouton mène directement aux réglages concernés.
const errToastReglages = msg => toast('⚠️ ' + msg, { kind: 'err', action: { label: 'Réglages', fn: () => openSettings() } });

window.addEventListener('error', e => { if (e && e.message) errToast('Erreur inattendue : ' + e.message); });
window.addEventListener('unhandledrejection', e => {
  const r = e.reason;
  if (r && r.name === 'AbortError') return;
  errToast('Erreur inattendue : ' + ((r && (r.message || r.code)) || 'inconnue'));
});

const SAVE_FAIL = 'Enregistrement impossible : la mémoire du téléphone est pleine ou bloquée. Ces modifications ne sont PAS conservées. Faites vite « Sauvegarder ma cave ».';
// Bible des vins : une fois par jour au plus, depuis le même site ; copie locale gardée pour le hors connexion.
const BIBLE_URL = 'bible/bible.json';
const BIBLE_EVERY = 864e5;
async function loadBible() {
  let local = null, localTxt = null;
  try { localTxt = await store.getMeta('bible'); local = JSON.parse(localTxt || 'null'); } catch (e) { local = null; }
  const avant = S.bible;
  if (L.bibleValid(local)) S.bible = local;
  if (S.bible && S.bible !== avant && S.ready) render(); // la liste a pu être dessinée avant que la bible soit connue
  const last = Number(await store.getMeta('bibleAt')) || 0;
  // Après une nouvelle version de l'appli, la bible est reprise tout de suite : sinon l'ancienne copie reste jusqu'à 24 h
  // et les dates de garde des fiches ne suivent pas la nouvelle formule d'apogée.
  const vue = await store.getMeta('bibleV');
  if (S.bible && vue === VERSION && Date.now() - last < BIBLE_EVERY) return;
  try {
    const r = await fetch(BIBLE_URL, { cache: 'no-cache' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const txt = await r.text();
    const j = JSON.parse(txt);
    if (!L.bibleValid(j)) throw new Error('format');
    if (!local || txt !== localTxt) { await store.setMeta('bible', txt); S.bible = j; if (S.ready) render(); } // la liste affichée avec l’ancienne copie est redessinée (apogée, fiabilité)
    await store.setMeta('bibleAt', Date.now());
    await store.setMeta('bibleV', VERSION);
  } catch (e) { console.warn('Bible non mise à jour :', e.message); }
}

async function persist(op) {
  try { await op(); return true; }
  catch (e) { console.error(e); Stats.track('err_enreg'); errToast(SAVE_FAIL); return false; }
}

/* ============ Feuilles (fenêtres du bas) et bouton retour Android ============ */
const stack = [];
let ignorePop = 0;
let logRunning = false;
function openSheet(id) {
  if (!stack.includes(id)) {
    if (!stack.length && !(history.state && history.state.modal)) { try { history.pushState({ modal: 1 }, ''); } catch (e) { /* sans historique */ } }
    stack.push(id);
    $('#' + id).dataset.dirty = '';
  }
  $('#' + id).classList.add('show');
}
function hideSheet(id) {
  const i = stack.indexOf(id); if (i >= 0) stack.splice(i, 1);
  $('#' + id).classList.remove('show');
  if (id === 'sDlg') { dlgForce = false; $('#sDlg').classList.remove('force'); settleDlg(null); }
  if (id === 'sCle') apresCle();
}
// Fermeture voulue par l’utilisateur (croix, glisser, Retour) : demande confirmation si une saisie non enregistrée existe.
const SAISIE_SHEETS = ['sForm', 'sTasting'];
async function requestClose(id) {
  const m = $('#' + id);
  if (!m || !m.classList.contains('show')) return;
  if (id === 'sLog' && logRunning) return;
  if (id === 'sDlg' && dlgForce) return;
  if (SAISIE_SHEETS.includes(id) && m.dataset.dirty === '1') {
    const c = await ask('Abandonner la saisie ?', 'Ce que vous avez écrit ne sera pas enregistré.',
      [{ label: 'Continuer la saisie', value: 'non', kind: 'o' }, { label: 'Abandonner', value: 'oui' }]);
    if (c !== 'oui') { const sh = m.querySelector('.sheet'); if (sh) sh.style.transform = ''; return; }
    m.dataset.dirty = '';
  }
  closeSheet(id);
}
let retourPrevu = false;
function closeSheet(id) {
  hideSheet(id);
  // différé : si une autre fenêtre s'ouvre juste après, on garde l'entrée d'historique.
  // Une seule fois même si deux fenêtres se ferment dans le même instant (sinon double retour).
  if (retourPrevu) return;
  retourPrevu = true;
  setTimeout(() => {
    retourPrevu = false;
    if (!stack.length && history.state && history.state.modal) { ignorePop++; history.back(); }
  }, 0);
}
// Croix en haut à droite et glisser vers le bas (depuis la moitié haute de la fenêtre) pour toutes les fenêtres.
const SANS_GLISSER = ['sDlg', 'sBienv'];
function initSheetGestures() {
  $$('.modal').forEach(m => {
    const sheet = m.querySelector('.sheet');
    if (!sheet) return;
    if (!sheet.querySelector('.sx')) {
      const x = document.createElement('button');
      x.type = 'button'; x.className = 'sx'; x.setAttribute('aria-label', 'Fermer'); x.textContent = '×';
      x.onclick = () => requestClose(m.id);
      sheet.prepend(x);
    }
    ['input', 'change'].forEach(ev => m.addEventListener(ev, () => { m.dataset.dirty = '1'; }));
    if (SANS_GLISSER.includes(m.id)) return;
    let y0 = null, dy = 0, drag = false;
    sheet.addEventListener('touchstart', e => {
      y0 = null;
      if (e.touches.length !== 1 || (m.id === 'sLog' && logRunning)) return;
      if (e.target.closest && e.target.closest('input,textarea,select,[contenteditable]')) return;
      const sc = sheet.querySelector('.sb') || sheet;
      const r = sheet.getBoundingClientRect();
      const y = e.touches[0].clientY;
      if (sc.scrollTop > 0 || y - r.top > r.height / 2) return;
      y0 = y; dy = 0; drag = false;
    }, { passive: true });
    sheet.addEventListener('touchmove', e => {
      if (y0 === null) return;
      dy = e.touches[0].clientY - y0;
      if (!drag) {
        if (dy < -8) { y0 = null; return; }
        if (dy < 8) return;
        drag = true; sheet.style.transition = 'none';
      }
      if (e.cancelable) e.preventDefault();
      sheet.style.transform = 'translateY(' + Math.max(0, dy) + 'px)';
    }, { passive: false });
    const fin = () => {
      const était = drag, d = dy;
      y0 = null; drag = false;
      if (!était) return;
      sheet.style.transition = 'transform .2s ease';
      if (d > 90) {
        sheet.style.transform = 'translateY(100%)';
        setTimeout(() => { sheet.style.transition = ''; sheet.style.transform = ''; requestClose(m.id); }, 200);
      } else sheet.style.transform = '';
    };
    sheet.addEventListener('touchend', fin);
    sheet.addEventListener('touchcancel', fin);
  });
}
window.addEventListener('popstate', () => {
  if (ignorePop) { ignorePop--; return; }
  const id = stack[stack.length - 1];
  if (!id) return;
  if ((id === 'sLog' && logRunning) || (id === 'sDlg' && dlgForce)) { try { history.pushState({ modal: 1 }, ''); } catch (e) { /* */ } return; }
  if (SAISIE_SHEETS.includes(id) && $('#' + id).dataset.dirty === '1') {
    // Retour : on garde la fenêtre ouverte le temps de demander confirmation
    try { history.pushState({ modal: 1 }, ''); } catch (e) { /* */ }
    requestClose(id);
    return;
  }
  hideSheet(id);
  if (stack.length) { try { history.pushState({ modal: 1 }, ''); } catch (e) { /* */ } }
});

// Garde les fenêtres au-dessus du clavier.
function fitViewport() {
  const v = window.visualViewport;
  const r = document.documentElement.style;
  r.setProperty('--vvt', (v ? v.offsetTop : 0) + 'px');
  r.setProperty('--vvh', (v ? v.height : window.innerHeight) + 'px');
}
if (window.visualViewport) { visualViewport.addEventListener('resize', fitViewport); visualViewport.addEventListener('scroll', fitViewport); }
window.addEventListener('resize', fitViewport);

/* ============ Boîte de dialogue ============ */
let dlgResolve = null;
let dlgForce = false; // fenêtre dont on ne sort qu'en répondant (ni croix, ni toucher à côté, ni Retour)
function settleDlg(v) { const r = dlgResolve; dlgResolve = null; if (r) r(v); }
function ask(title, text, buttons, opts) {
  return new Promise(resolve => {
    settleDlg(null);
    dlgResolve = resolve;
    dlgForce = !!(opts && opts.force);
    $('#sDlg').classList.toggle('force', dlgForce);
    $('#dlgT').textContent = title;
    $('#dlgX').textContent = text || '';
    const box = $('#dlgB'); box.innerHTML = '';
    for (const b of buttons) {
      const el = document.createElement('button');
      el.className = 'btn' + (b.kind ? ' ' + b.kind : '');
      el.textContent = b.label;
      el.onclick = () => { const r = dlgResolve; dlgResolve = null; dlgForce = false; closeSheet('sDlg'); if (r) r(b.value); };
      box.appendChild(el);
    }
    openSheet('sDlg');
  });
}

/* ============ Affichage ============ */
const fmtEur = v => Math.round(v).toLocaleString('fr-FR') + ' €';
const fmtPrice = v => (Math.round(v * 100) / 100).toLocaleString('fr-FR', { minimumFractionDigits: v % 1 ? 2 : 0 }) + ' €';

function card(w, mode, why) {
  const st = L.status(w, YEAR);
  const meta = [w.color, w.grape, w.price !== '' ? fmtPrice(w.price) : '', w.loc ? '📍 ' + w.loc : ''].filter(Boolean).map(esc).join(' · ');
  // Maturité (frise, pastille, fiabilité) : seulement pour un vin avec millésime et une fenêtre exploitable.
  const apoM = w.name && w.year ? apogee(w, YEAR, L.bibleQuality(w, S.bible)) : null;
  const mat = apoM ? fenetreMaturite(w, apoM) : null;
  const tags = [
    w.check ? '<span class="tag bad">à vérifier</span>' : '',
    mat ? pastilleHtml(mat, YEAR) : st ? `<span class="tag stp ${st.cls}">${st.label}${w.from || w.to ? ' (' + (w.from || '…') + '–' + (w.to || '…') + ')' : ''}</span>` : '',
    w.qty <= 0 ? '<span class="tag">plus en cave</span>' : '',
  ].filter(Boolean).join(' ');
  const tags2 = [
    w.conf === 'estimée' ? '<span class="tag wa">fiche estimée</span>' : '',
    w.conf === 'vérifiée' ? '<span class="tag ok">fiche vérifiée</span>' : '',
    L.gardeConfirmee(w) ? '<i>confirmé</i>' : '',
    !L.gardeConfirmee(w) && w.src && w.src.from === 'bible' ? '<i>bible</i>' : '',
    !L.gardeConfirmee(w) && w.src && w.src.from === 'calc' ? '<span class="tag">garde calculée selon le rang du vin</span>' : '',
  ].filter(Boolean).join(' · ');
  const hasFiche = w.story || w.pairings.length || w.note || w.sources.length;
  // Apogée estimée par la règle de l'appli (sans IA) : affichée dans la fiche du vin.
  const apoA = w.name ? apogee(w, YEAR, L.bibleQuality(w, S.bible)) : null;
  const apo = apoA ? apogeeTexte(apoA) : '';
  // Garde modifiée par l'utilisateur : jamais remplacée, mais signalée si elle s'écarte d'au moins 2 ans de la bible ou du calcul.
  let ecart = null;
  if (w.src && (w.src.from === 'user' || w.src.to === 'user') && w.from && w.to && S.bible) {
    const ref = { ...w, from: '', to: '', src: {} };
    L.prefillFromBible(ref, S.bible, fenetreRang);
    if (ref.from && ref.to && (Math.abs(ref.from - w.from) >= 2 || Math.abs(ref.to - w.to) >= 2)) ecart = { from: ref.from, to: ref.to };
  }
  const fb = mat && S.bible ? fiabilite({ ecart, userGarde: !!(w.src && (w.src.from === 'user' || w.src.to === 'user')), confirmee: L.gardeConfirmee(w), entree: !!L.bibleEntry(w, S.bible) || !!(w.src && (w.src.from === 'bible' || w.src.to === 'bible')), connue: apoM.connue, w }) : null;
  const frise = (mat ? friseSvg(mat, YEAR) + fiabiliteHtml(fb) : '') + (horsBible(w) ? hbEncartHtml() : '');
  const svc = w.name ? [serviceTexte(w), carafageTexte(w, YEAR)].filter(Boolean).join(' ') : '';
  const pf = w.name ? profil(w) : null;
  const repAppel = pf ? `Repères de l’appellation ${pf.appellation} (indicatifs) : ${[!w.grape ? 'cépages ' + pf.cepages : '', !w.pairings.length ? 'accords classiques : ' + pf.accords : ''].filter(Boolean).join(' ; ')}.` : '';
  const majIA = L.aiFields(w);
  const qty = mode === 'cave'
    ? `<div class="q"><button data-a="m" aria-label="Retirer une bouteille">−</button><b>${w.qty}</b><button data-a="p" aria-label="Ajouter une bouteille">+</button></div>`
    : `<b style="font-size:18px">${w.qty}×</b>`;
  return `<div class="w${w.qty <= 0 ? ' out' : ''}${mat && w.qty > 0 ? ' ph-' + phase(mat, YEAR) : ''}${S.highlight === w.id ? ' hl' : ''}" data-id="${esc(w.id)}">
  ${why ? `<p class="why">💡 ${esc(why)}</p>` : ''}
  <div class="row"><div><h4>${esc(w.name)}${w.year ? ' ' + esc(w.year) : ''}</h4><p>${esc([w.dom, w.region].filter(Boolean).join(' · '))}</p></div>${qty}</div>
  ${meta || tags ? `<div class="ml">${meta ? `<p class="mm">${meta}</p>` : ''}${tags ? `<p class="stl">${tags}</p>` : ''}</div>` : ''}
  <div class="fr">${hasFiche || apo || svc || tags2 ? `<details${S.ouvert.has(w.id) ? ' open' : ''}><summary>Fiche et accords</summary>${tags2 ? `<p class="mu small sec">${tags2}</p>` : ''}${degLigne(w)}${frise}${blocFiche('Repères', reperesHtml(apo, svc) + (repAppel && (!w.grape || !w.pairings.length) ? `<p class="mu small">${esc(repAppel)}</p>` : '') + (majIA.length ? `<p class="mu small">Mis à jour par l’assistant : ${esc(majIA.join(', '))}.</p>` : ''))}${w.story ? blocFiche('L’histoire', histoireHtml(w.story) + relireHtml(w)) : ''}${w.pairings.length ? blocFiche('Accords', `<p>${w.pairings.map(p => `<span class="pc">${esc(p)}</span>`).join('')}</p>`) : ''}${w.note ? `<p><i>${esc(w.note)}</i></p>` : ''}${w.sources.length ? `<p class="src">Sources consultées : ${w.sources.map(x => `<a href="${esc(x.u)}" target="_blank" rel="noopener noreferrer">${esc(x.t)}</a>`).join(' · ')}</p>` : ''}${journalHtml(w, mode)}</details>` : degLigne(w) + journalHtml(w, mode)}<button class="am" type="button" data-a="menu" aria-haspopup="dialog">⋯ Actions</button></div>
  <div class="acts-h" hidden>${!w.story && !w.pairings.length ? '<button data-a="gen" type="button">✨ Fiche par l’assistant</button>' : ''}<button data-a="e" type="button">Modifier</button>${mode === 'cave' ? '<button data-a="d" type="button">Supprimer</button>' : ''}</div>
</div>`;
}

// Mise en page de la fiche dépliée (affichage seulement : les textes enregistrés ne changent pas).
const blocFiche = (titre, html) => html ? `<section class="bl"><h5>${esc(titre)}</h5>${html}</section>` : '';
// Repères : valeurs alignées en deux colonnes (Apogée, Service) ; la règle et le conseil de carafage passent en petit dessous.
function reperesHtml(apo, svc) {
  const lignes = [];
  if (apo) {
    const m = /^Apogée estimée (\d{4})(?: \(([^)]*)\))?(?: : ([^.]*))?\.\s*(.*)$/.exec(apo);
    lignes.push(m
      ? ['Apogée', `<b>${esc(m[1])}</b>${m[2] ? ` <span class="mu">(${esc(m[2])})</span>` : ''}${m[3] ? ` · ${esc(m[3])}` : ''}<small>Estimation${m[4] ? ' · ' + esc(m[4]) : ''}</small>`]
      : ['Apogée', esc(apo)]);
  }
  if (svc) {
    const m = /^Service : (.+? °C)\.\s*(.*)$/.exec(svc);
    lignes.push(m ? ['Service', `<b>${esc(m[1])}</b>${m[2] ? `<small>${esc(m[2])}</small>` : ''}`] : ['Service', esc(svc)]);
  }
  return lignes.length ? `<dl class="kv">${lignes.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>` : '';
}
// Histoire : toutes les phrases sont gardées ; la première sert d'accroche, le reste est aéré par paragraphes de deux phrases.
function histoireHtml(story) {
  const ph = String(story).trim().split(/(?<=[.!?…])\s+(?=[A-ZÀ-ÝÉ«“"])/).filter(Boolean);
  if (!ph.length) return '';
  const reste = [];
  for (let i = 1; i < ph.length; i += 2) reste.push(ph.slice(i, i + 2).join(' '));
  return `<p class="hist lead">${esc(ph[0])}</p>${reste.map(t => `<p class="hist">${esc(t)}</p>`).join('')}`;
}

// 1.40.0 : histoire écrite par l'assistant et pas encore relue : mention discrète avec le prénom, et « J'ai relu » (l'histoire n'est alors plus réécrite par l'assistant).
function relireHtml(w) {
  return L.aRelire(w) ? `<p class="rlr"><span>À relire${prenomMem ? ', ' + esc(prenomMem) : ''}</span><button class="lnk" data-a="relu" type="button">J’ai relu</button></p>` : '';
}

// Journal de dégustation (saisie manuelle uniquement).
function journalHtml(w, mode) {
  if (mode !== 'cave' && mode !== 'boire') return '';
  const t = Array.isArray(w.tastings) ? w.tastings : [];
  const lignes = t.map((x, i) => `<li><span class="etoiles" aria-label="${x.n} sur 5">${'★'.repeat(x.n)}${'☆'.repeat(5 - x.n)}</span> <span class="mu small">${esc(x.d.split('-').reverse().join('/'))}</span>${x.c ? `<br>${esc(x.c)}` : ''} <button class="lnk" data-a="dgdel" data-i="${i}">Supprimer</button></li>`).join('');
  return `<div class="jr"><p><b>Journal de dégustation</b></p>${lignes ? `<ul>${lignes}</ul>` : '<p class="mu small">Aucune dégustation notée.</p>'}<button class="lnk" data-a="dg">+ Noter une dégustation</button></div>`;
}
function degLigne(w) {
  const d = L.degustations(w);
  if (!d) return '';
  return `<p class="mu small">Dégusté ${d.count} fois · moyenne ${String(d.avg).replace('.', ',')}/5</p>`;
}
let tgWine = null; let tgNote = 0;
function openTasting(w) {
  tgWine = w; tgNote = 0;
  const d = new Date();
  $('#tg-date').value = [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-');
  $('#tg-name').textContent = w.name + (w.year ? ' ' + w.year : '');
  $('#tg-c').value = '';
  paintStars();
  openSheet('sTasting');
}
function paintStars() {
  $$('#tg-stars [data-n]').forEach(b => { const n = Number(b.dataset.n); b.textContent = n <= tgNote ? '★' : '☆'; b.setAttribute('aria-checked', n === tgNote ? 'true' : 'false'); });
}
async function saveTasting() {
  const w = tgWine; if (!w) return;
  if (!tgNote) { errToast('Choisissez une note de 1 à 5 étoiles.'); return; }
  const date = $('#tg-date').value;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { errToast('Date invalide.'); return; }
  const copie = JSON.parse(JSON.stringify(w));
  copie.tastings = [...(Array.isArray(copie.tastings) ? copie.tastings : []), { d: date, n: tgNote, c: $('#tg-c').value.trim().slice(0, 500) }];
  copie.updated = Date.now();
  const idx = S.wines.indexOf(w);
  S.wines[idx] = copie;
  if (await persist(() => store.putWines([copie]))) { closeSheet('sTasting'); tgWine = null; render(); toast('Dégustation notée.'); }
  else { S.wines[idx] = w; render(); }
}

// Valeur estimée (indicative) affichée dans l'en-tête ; l'utilisateur peut la cacher d'un geste (préférence gardée sur ce téléphone).
const valeurCachee = () => { try { return localStorage.getItem('cave-cacher-valeur') === '1'; } catch (e) { return false; } };
function renderStats() {
  const s = L.stats(S.wines, YEAR);
  const v = L.valeurEstimee(S.wines);
  const cache = valeurCachee();
  $('#sB').textContent = s.bottles.toLocaleString('fr-FR');
  $('#sV').textContent = cache ? '•••' : v.couverts ? '≈ ' + fmtEur(v.total) : 'à estimer';
  $('#sVbtn').setAttribute('aria-pressed', String(cache));
  $('#sD').textContent = s.soon.toLocaleString('fr-FR');
}

function renderBanners() {
  const out = [];
  if (S.ready && !store.persistent) out.push(`<div class="banner err"><p>Stockage indisponible sur ce navigateur (navigation privée ?). Vos données ne seront pas conservées après fermeture.</p></div>`);
  if (S.ready && S.wines.length) {
    const days = S.lastBackup ? Math.floor((Date.now() - S.lastBackup) / 864e5) : null;
    if (days === null || days >= BACKUP_DAYS) out.push(`<div class="banner"><p>💾 ${days === null ? 'Aucune sauvegarde de votre cave.' : 'Dernière sauvegarde il y a ' + days + ' jours.'} Sauvegardez au moins tous les 2 mois.</p><button class="btn sm" data-b="bk">Sauvegarder</button></div>`);
  }
  $('#banners').innerHTML = out.join('');
  // Mise à jour : bandeau plein écran, collé en haut, impossible à manquer.
  $('#updBar').innerHTML = S.update ? `<div class="upd"><span class="ic" aria-hidden="true">⬆️</span><div class="tx"><b>Nouvelle version prête</b><span>Touchez le bouton pour l’installer</span></div><button class="btn" data-b="upd">Mettre à jour</button></div>` : '';
  // Les messages passent sous la barre de mise à jour : on mesure sa hauteur réelle.
  document.documentElement.style.setProperty('--upd-h', (S.update ? $('#updBar').offsetHeight : 0) + 'px');
}

function filtered() {
  return S.wines.filter(w => (S.filt === 'Tous' || (S.filt === 'À vérifier' ? w.check : w.color === S.filt)) && L.matchesQuery(w, S.q)
    && (!S.statut || (w.qty > 0 && statutOf(w, YEAR) === S.statut)));
}

function renderList() {
  const counts = { Tous: S.wines.length, 'À vérifier': S.wines.filter(w => w.check).length };
  for (const c of L.COLORS) counts[c] = S.wines.filter(w => w.color === c).length;
  const chips = ['Tous', ...(counts['À vérifier'] || S.filt === 'À vérifier' ? ['À vérifier'] : []), ...L.COLORS.filter(c => counts[c] || S.filt === c)];
  // Filtre par statut (depuis Magic) : une pastille pour le retirer.
  const pastille = S.statut ? `<button class="chip on" data-stat="">✕ ${STATUT_LIBELLE[S.statut]}</button>` : '';
  $('#chips').innerHTML = pastille + chips.map(c => `<button class="chip${c === S.filt ? ' on' : ''}" data-c="${c}">${c} <span class="n">${counts[c] || 0}</span></button>`).join('');
  if (!S.ready) { $('#list').innerHTML = '<p class="empty">Chargement de votre cave…</p>'; return; }
  if (!S.wines.length) {
    $('#list').innerHTML = `<div class="empty vide"><p class="vt"><b>Bienvenue dans votre cave.</b></p><p>Pour voir tout de suite comment ça marche (tri, recherche, accords, dates de garde), essayez avec 15 bouteilles fictives. Vous les effacez d’un geste.</p><div class="stack">
      <button class="btn" data-m="demo">🍷 Essayer avec une cave de démonstration (15 bouteilles)</button><p class="mu small ou">ou ajoutez vos propres bouteilles :</p>
      <button class="btn o" data-m="cam">📷 Scanner une étiquette</button><button class="btn o" data-m="img">🖼️ Importer des photos (plusieurs)</button>
      <button class="btn o" data-m="xls">📊 Importer un tableur (Excel, CSV)</button><button class="btn o" data-m="man">✍️ Saisie manuelle</button>
      <button class="btn o" data-m="res">♻️ Restaurer une sauvegarde</button><button class="btn o" data-m="help">❔ Guide : importer toute ma cave</button></div></div>`;
    return;
  }
  const items = L.sortWines(filtered(), S.sort, YEAR);
  const demoBar = S.wines.some(isDemo) ? `<div class="demobar"><span>🍷 <b>Cave de démonstration</b> : ces vins sont fictifs.</span><button class="btn o" type="button" data-m="democlear">Effacer la démo</button></div>` : '';
  if (!items.length) { $('#list').innerHTML = demoBar + '<p class="empty">Aucun vin ne correspond.</p>'; return; }
  const shown = items.slice(0, S.limit);
  $('#list').innerHTML = demoBar + shown.map(w => card(w, 'cave')).join('') +
    (items.length > shown.length ? `<button class="btn o more" data-a="more">Afficher plus (${shown.length} sur ${items.length})</button>` : '');
}

// Fenêtre à consommer : la garde (saisie ou bible) si elle existe, sinon l'apogée calculée par l'appli.
// null = pas de fenêtre (vin sans millésime ni garde).
function fenetreDe(w) {
  if (w.from || w.to) return { from: w.from || null, to: w.to || null };
  const a = apogee(w, YEAR, L.bibleQuality(w, S.bible));
  return a.sansMillesime ? null : { from: a.from, to: a.to };
}
// Copie du vin avec la fenêtre effective, pour le classement seulement (la fiche garde ses données d'origine).
const avecFenetre = w => { const f = fenetreDe(w); return f ? { ...w, from: f.from, to: f.to } : w; };

// Classement « Avec un plat » : même logique, les résultats renvoient les vins d'origine.
function classerPlat(dish, n) {
  const originaux = new Map(S.wines.map(w => [w.id, w]));
  return L.localPairing(dish, S.wines.map(avecFenetre), YEAR, n).map(r => ({ ...r, w: originaux.get(r.w.id) }));
}

function renderBoire() {
  const modes = [['year', 'Cette année'], ['soon', 'À boire vite'], ['dish', 'Avec un plat'], ['apogee', 'Apogée']];
  $('#bchips').innerHTML = modes.map(([k, l]) => `<button class="chip${k === S.bmode ? ' on' : ''}${k === 'apogee' ? ' sec' : ''}" data-b="${k}">${l}</button>`).join('');
  $('#plat').hidden = S.bmode !== 'dish';
  if (S.bmode === 'dish') return; // résultats rendus par la recherche
  const stock = S.wines.filter(w => w.qty > 0);
  let items;
  if (S.bmode === 'apogee') {
    // Vins dont la fenêtre d'apogée contient l'année en cours, du pic le plus proche au plus lointain.
    items = stock.map(w => ({ w, a: apogee(w, YEAR, L.bibleQuality(w, S.bible)) }))
      .filter(x => !x.a.sansMillesime && x.a.from <= YEAR && YEAR <= x.a.to)
      .sort((x, y) => x.a.pic - y.a.pic || (x.w.name || '').localeCompare(y.w.name || '', 'fr'));
  } else {
    items = stock.map(w => ({ w, f: fenetreDe(w) }))
      .filter(x => {
        if (S.bmode === 'year') return x.f ? (!x.f.from || x.f.from <= YEAR) && (!x.f.to || x.f.to >= YEAR) : true; // sans millésime : prêt à boire
        return !!(x.f && x.f.to && x.f.to <= YEAR + 1);
      })
      .sort((x, y) => ((x.f && x.f.to) || 9999) - ((y.f && y.f.to) || 9999));
  }
  // Pourquoi ce vin : chiffres déjà calculés par les règles de l’appli, rien d’inventé.
  const pourquoi = x => {
    if (S.bmode === 'apogee') return x.a && x.a.pic ? `Apogée estimée vers ${x.a.pic} (fenêtre ${x.a.from}–${x.a.to}).` : '';
    const f = x.f; if (!f) return S.bmode === 'year' ? 'Sans millésime : considéré prêt à boire.' : '';
    if (S.bmode === 'soon') return f.to ? (f.to < YEAR ? `Fenêtre de garde terminée en ${f.to}.` : f.to === YEAR ? `Fenêtre de garde qui se termine cette année (${f.to}).` : `Fenêtre de garde jusqu’en ${f.to}.`) : '';
    return f.to ? `Dans sa période de garde, jusqu’en ${f.to}.` : (f.from ? `Dans sa période de garde, depuis ${f.from}.` : '');
  };
  const list = items.map(x => x.w);
  const head = list.length ? `<p class="mu small">${list.length} vin${list.length > 1 ? 's' : ''} · ${list.reduce((a, w) => a + w.qty, 0)} bouteille(s)</p>` : '';
  const vide = { year: 'Aucun vin dans sa période idéale cette année.', soon: 'Aucun vin proche de la fin de sa fenêtre.', apogee: 'Aucun vin à l’apogée cette année.' }[S.bmode];
  $('#blist').innerHTML = head + (list.length ? items.map(x => card(x.w, 'boire', pourquoi(x))).join('') : `<p class="empty">${vide}</p>`);
}

function renderDatalists() {
  const fill = (id, key) => {
    const vals = [...new Set(S.wines.map(w => w[key]).filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b), 'fr')).slice(0, 400);
    $('#' + id).innerHTML = vals.map(v => `<option value="${esc(v)}">`).join('');
  };
  fill('dl-name', 'name'); fill('dl-dom', 'dom'); fill('dl-region', 'region'); fill('dl-loc', 'loc');
}

function render() {
  renderStats(); renderBanners();
  $$('.tab').forEach(b => { const on = b.dataset.t === S.tab; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); });
  $('#vCave').hidden = S.tab !== 'cave'; $('#vBoire').hidden = S.tab !== 'boire'; $('#vChiffres').hidden = S.tab !== 'chiffres'; document.querySelector('.stats').hidden = S.tab === 'chiffres' || (S.ready && !S.wines.length);   // pas de compteurs à zéro sur une cave vide
  if (S.tab === 'cave') renderList(); else if (S.tab === 'boire') renderBoire(); else renderChiffres();
  // Transition douce à chaque changement d'onglet (jamais quand la même vue est simplement redessinée).
  if (S.lastTab && S.lastTab !== S.tab) {
    const v = S.tab === 'cave' ? $('#vCave') : S.tab === 'boire' ? $('#vBoire') : $('#vChiffres');
    if (v) { v.classList.remove('vin'); void v.offsetWidth; v.classList.add('vin'); setTimeout(() => v.classList.remove('vin'), 400); }
  }
  S.lastTab = S.tab;
  avisSiChange();
}
// « Magic » : tableau de bord de la cave. Calcul local, sans IA.
const PALETTE = ['#7b1e3a', '#b5545f', '#d68c96', '#e9c2c8', '#5b4a4f', '#9b8b90', '#c9bcc0', '#3d2c31'];
function donut(rows, total, nom) {
  // Au-delà de 6 parts, le reste est regroupé dans « Autres » pour garder une légende lisible.
  let parts = rows.slice(0, 6);
  const reste = rows.slice(6).reduce((s, r) => s + r[1], 0);
  if (reste) parts = [...parts, ['Autres', reste]];
  let off = 25, arcs = '';
  parts.forEach(([k, n], i) => {
    const p = total ? (n / total) * 100 : 0;
    arcs += `<circle r="15.915" cx="21" cy="21" fill="none" stroke="${PALETTE[i % PALETTE.length]}" stroke-width="6" stroke-dasharray="${p.toFixed(2)} ${(100 - p).toFixed(2)}" stroke-dashoffset="${off.toFixed(2)}"><title>${esc(k)} : ${n}</title></circle>`;
    off -= p;
  });
  const legende = parts.map(([k, n], i) => `<li><span class="sw" style="background:${PALETTE[i % PALETTE.length]}"></span><span class="lk">${esc(k)}</span><b>${pct(n, total)} %</b></li>`).join('');
  return `<div class="donut"><svg viewBox="0 0 42 42" role="img" aria-label="${esc(nom)} : ${total} bouteilles">${arcs}<text x="21" y="20" class="dc">${total}</text><text x="21" y="26" class="dl">bouteilles</text></svg><ul class="legende">${legende}</ul></div>`;
}
const pct = (n, total) => (total ? Math.round((n / total) * 100) : 0);
// Équilibre (lecture des chiffres, sans IA) et valeur estimée (indicative). Les deux boutons IA sont optionnels.
function bilanHtml(c) {
  const v = L.valeurEstimee(S.wines);
  const reste = v.bouteilles - v.couverts;
  const titre = prenomMem ? `Avis sur l’équilibre de votre cave, ${esc(prenomMem)}` : 'Avis sur l’équilibre de votre cave';
  const court = avisMem && (avisMem.court || avisMem.texte);
  const complet = avisMem && avisMem.complet;
  let avisHtml;
  if (avisEnCours && !court) avisHtml = '<span class="mu">Lecture de la cave…</span>';
  else if (court) {
    const m = avisMem, struct = !!(m.solide || m.manque || m.priorite);
    const date = new Date(m.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
    const pied = `<span class="mu small">Avis du ${date} · impression, sans vérification${avisEnCours ? ' · mise à jour en cours' : ''}${m.erreur ? ' · mise à jour impossible : ' + esc(m.erreur) : ''}</span>`;
    const detail = complet ? `<details class="avis-complet"><summary>Avis complet</summary><p>${esc(symPct(complet))}</p></details>` : '';
    const bloc = (cls, titre, items) => items && items.length ? `<section class="ab ${cls}"><h4>${titre}</h4><ul>${items.map(x => `<li>${esc(symPct(x))}</li>`).join('')}</ul></section>` : '';
    avisHtml = struct
      ? `<p class="avis-lead">${esc(symPct(court))}</p>${m.cles && m.cles.length ? `<ul class="cles">${m.cles.map(x => `<li>${esc(symPct(x))}</li>`).join('')}</ul>` : ''}${bloc('ab-ok', 'Ce qui est solide', m.solide)}${bloc('ab-wa', 'Ce qui manque', m.manque)}${bloc('ab-pr', 'À acheter ou faire en priorité', m.priorite)}${detail}${pied}`
      : `${esc(court)}${detail}${pied}`;
  }
  else if (avisMem && avisMem.erreur) avisHtml = `<span class="mu">Pas encore d’avis : ${esc(avisMem.erreur)}</span>`;
  else avisHtml = `<span class="mu">${AI.avisPossible() ? 'Avis en préparation…' : 'L’avis de l’assistant demande votre propre clé, à ajouter dans ⚙ Réglages.'}</span>`;
  return `<div class="bilan">
    <h3 class="bt">Équilibre de ma cave</h3>
    <p class="bsub"><b>${titre}</b></p>
    <div id="avisIA" class="small">${avisHtml}</div>
    <p><b>Équilibre</b> ${esc(L.equilibre(c))}</p>
    <p><b>Valeur estimée</b> ${v.couverts ? `≈ ${fmtEur(v.total)}` : 'pas encore estimée'}</p>
    <p class="mu small">${v.couverts ? `${v.couverts} bouteille(s) sur ${v.bouteilles} estimée(s). ` : ''}Estimation indicative : peu de prix d’achat sont saisis, donc elle repose sur les connaissances de l’IA, sans vérification. Ce n’est pas une valeur de revente garantie.</p>
    ${reste ? `<button class="lnk" data-act="valeur" type="button">Estimer la valeur avec l’assistant</button>` : ''}
  </div>`;
}

function renderChiffres() {
  const c = chiffres(S.wines, YEAR);
  const bars = (rows, total, sub) => rows.map(([k, n, s]) => `<div class="bar"><span>${esc(k)}${sub && s ? ` <small class="mu">${esc(s)}</small>` : ''}</span><i style="width:${total ? Math.max(4, Math.round(n / total * 100)) : 0}%"></i><b>${n}</b></div>`).join('') || '<p class="mu small">Rien à afficher.</p>';
  const maxF = Math.max(1, ...c.frise.map(x => x[1]));
  const frise = c.frise.map(([y, n]) => `<div class="fcol" title="${y} : ${n} bouteille${n > 1 ? 's' : ''}"><i style="height:${Math.round(n / maxF * 100)}%"></i><span>${y}</span></div>`).join('');
  const st = c.statuts;
  $('#vChiffres').innerHTML = `
    <p class="portrait">${esc(c.portrait)}</p>
    ${c.bouteilles ? `
    <div class="statuts">
      <button class="st ok" data-goto="pret" aria-label="Voir les vins prêts à boire"><b>${st.pret}</b><span>Prêt à boire</span></button>
      <button class="st wa" data-goto="garder" aria-label="Voir les vins à garder"><b>${st.garder}</b><span>À garder</span></button>
      <button class="st bad" data-goto="urgence" aria-label="Voir les vins à boire en urgence"><b>${st.urgence}</b><span>Urgence</span></button>
    </div>
    <p class="mu small">Touchez une case pour voir les vins concernés.</p>
    ${st.sans ? `<p class="mu small">${st.sans} bouteille(s) sans période de garde, non classées.</p>` : ''}
    ${bilanHtml(c)}
    <h3 class="ch">Couleurs</h3>${donut(c.couleurs, c.bouteilles, 'Couleurs')}
    <h3 class="ch">Régions</h3>${donut(c.regions, c.bouteilles, 'Régions')}
    <h3 class="ch">Cépages</h3>${bars(c.cepages, c.bouteilles)}
    <h3 class="ch">Époques des millésimes</h3>${bars(c.decennies, c.bouteilles)}
    <h3 class="ch">À boire, année par année</h3>
    <div class="frise">${frise}</div>
    <p class="mu small">${c.pic ? `Pic en ${c.pic.annee} : ${c.pic.bouteilles} bouteille${c.pic.bouteilles > 1 ? 's' : ''} à boire.` : 'Aucune bouteille avec une période de garde.'}</p>
    <h3 class="ch">Équilibre</h3>
    <p class="small">${c.diversite.regions} région(s), ${c.diversite.cepages} cépage(s). La première région pèse ${c.diversite.partRegionTop} % de la cave.</p>
    <h3 class="ch">Valeur</h3>
    <p class="small">${c.valeur.total ? `Valeur d’achat connue : ${c.valeur.total.toLocaleString('fr-FR')} €.` : 'Pas de prix renseigné.'}${c.valeur.sansPrix ? ` ${c.valeur.sansPrix} bouteille(s) sans prix.` : ''}</p>` : ''}`;
}

/* ============ Fiche (formulaire) ============ */
const F = id => $('#f-' + id);
function openForm(w, title) {
  S.editId = w && w.id && S.wines.some(x => x.id === w.id) ? w.id : null;
  // 1.40.0 : aiStory = histoire écrite par l'assistant et pas encore relue ; relu / web / genOk = gestes faits pendant cette ouverture du formulaire.
  S.formExtra = { conf: (w && w.conf) || '', sources: (w && w.sources) || [],
    aiStory: w && L.aRelire(w) ? String(w.story).trim() : '', relu: false, web: Number(w && w.histWeb) || 0, genOk: false };
  $('#f-enc').hidden = true; effacerPhotoForm();
  $('#fT').textContent = title || (S.editId ? 'Modifier le vin' : 'Ajouter un vin');
  const v = w || {};
  F('name').value = v.name || ''; F('dom').value = v.dom || ''; F('year').value = v.year || '';
  F('color').value = L.COLORS.includes(v.color) ? v.color : 'Rouge';
  F('region').value = v.region || ''; F('grape').value = v.grape || '';
  F('qty').value = v.qty ?? 1; F('price').value = v.price !== undefined && v.price !== '' ? String(v.price).replace('.', ',') : '';
  F('from').value = v.from || ''; F('to').value = v.to || ''; F('loc').value = v.loc || '';
  F('story').value = v.story || ''; F('pairings').value = (v.pairings || []).join(', '); F('note').value = v.note || '';
  F('gen').hidden = S.editId ? L.generationFaite(w) : false; // une seule génération par vin
  majRelecture();
  renderDatalists();
  closeSheet('sMenu');
  openSheet('sForm');
  $('#sForm .sb').scrollTop = 0;
}

// Mention « À relire, <prénom> » sous l'histoire écrite par l'assistant, et recours « Pas satisfait ? Chercher sur le web » (une seule fois par vin).
// L'histoire retouchée à la main n'est plus celle de l'assistant : la mention et le bouton disparaissent d'eux-mêmes.
function majRelecture() {
  const X = S.formExtra || {}, cur = F('story').value.trim();
  const deIA = !!cur && cur === X.aiStory;
  F('rl').hidden = !deIA;
  F('rl-t').textContent = X.relu ? '✓ Relue' : 'À relire' + (prenomMem ? ', ' + prenomMem : '');
  F('rl-ok').hidden = !!X.relu;
  const web = deIA && !X.relu && !X.web;
  F('web').hidden = !web; F('web-n').hidden = !web;
}

async function webHistoire() {
  const X = S.formExtra, f = readForm();
  if (!f.name && !f.dom) { errToast('Indiquez au moins le nom ou le domaine.'); F('name').focus(); return; }
  const consigne = L.consigneHistoire(f);
  const c = await ask('Ouvrir Google ?', `Google s’ouvre en mode IA, dans une nouvelle fenêtre, avec cette consigne déjà écrite : « ${consigne} » Le nom du vin et du domaine est envoyé à Google. Cette recherche n’est proposée qu’une seule fois pour ce vin.`, [
    { label: 'Ouvrir Google', value: 'go' }, { label: 'Annuler', value: null, kind: 'o' }]);
  if (c !== 'go') return;
  const win = window.open(L.urlRechercheIA(consigne), '_blank');
  if (!win) { errToast('Le navigateur a bloqué l’ouverture de Google. Autorisez les fenêtres pour cette appli, puis touchez de nouveau le bouton.'); return; }
  try { win.opener = null; } catch (e) { /* sans effet */ }
  X.web = Date.now();
  majRelecture();
  // Vin déjà enregistré : l'usage est gardé tout de suite (le bouton ne reviendra pas, même si le formulaire est fermé sans enregistrer).
  const old = S.editId && S.wines.find(w => w.id === S.editId);
  if (old) { old.histWeb = X.web; await persist(() => store.putWines([old])); }
}

function readForm() {
  const yr = v => { const n = num(v); return n === '' ? '' : n; };
  return {
    name: F('name').value.trim(), dom: F('dom').value.trim(), year: yr(F('year').value), color: F('color').value,
    region: F('region').value.trim(), grape: F('grape').value.trim(), qty: num(F('qty').value), price: price(F('price').value),
    priceRaw: F('price').value.trim(), from: yr(F('from').value), to: yr(F('to').value), loc: F('loc').value.trim(),
    story: F('story').value.trim(), pairings: F('pairings').value.split(',').map(s => s.trim()).filter(Boolean), note: F('note').value.trim(),
  };
}

function validate(f) {
  const bad = (id, msg) => { errToast(msg); F(id).focus(); return false; };
  if (!f.name) return bad('name', 'Le nom du vin est obligatoire.');
  if (f.year !== '' && (f.year < 1800 || f.year > YEAR + 1)) return bad('year', 'Millésime invalide.');
  if (f.qty !== '' && f.qty < 0) return bad('qty', 'La quantité ne peut pas être négative.');
  if (f.priceRaw && f.price === '') return bad('price', 'Prix invalide (exemple : 24,50).');
  for (const k of ['from', 'to']) if (f[k] !== '' && (f[k] < 1800 || f[k] > 2200)) return bad(k, 'Année de garde invalide.');
  if (f.from !== '' && f.to !== '' && f.from > f.to) return bad('from', 'Le début de garde est après la fin.');
  return true;
}

// 1.40.0 : gestes faits dans le formulaire (génération, relecture, recherche web), à enregistrer avec la fiche ; ceux d'avant sont gardés.
function gestesFiche(old) {
  const X = S.formExtra || {}, now = Date.now();
  return {
    genFaite: X.genOk ? now : (old && old.genFaite) || 0,
    histRelue: X.relu && F('story').value.trim() === X.aiStory ? now : (old && old.histRelue) || 0,
    histWeb: X.web || (old && old.histWeb) || 0,
  };
}

async function saveForm() {
  const f = readForm();
  if (!validate(f)) return;
  delete f.priceRaw;
  if (f.qty === '') f.qty = 1;
  const now = Date.now();
  if (S.editId) {
    const old = S.wines.find(w => w.id === S.editId);
    if (!old) { errToast('Ce vin n’existe plus.'); closeSheet('sForm'); return; }
    const src = L.editSrc(old, f, S.formExtra.aiGen);
    const nw = L.normalizeWine({ ...old, ...f, src, check: false, conf: S.formExtra.conf || old.conf, sources: S.formExtra.sources, updated: now, ...gestesFiche(old) });
    L.prefillFromBible(nw, S.bible, fenetreRang);
    L.prefillReperes(nw, repereVin, accordsRepere);
    Object.assign(old, nw);
    const ok = await persist(() => store.putWines([old]));
    finishSave(old, ok, '« ' + old.name + ' » modifié.');
    return;
  }
  const src = L.editSrc(null, f, S.formExtra.aiGen);
  const nw = L.normalizeWine({ ...f, src, id: uid(), conf: S.formExtra.conf, sources: S.formExtra.sources, check: false, created: now, updated: now, ...gestesFiche(null) });
  // Tampon : la bible remplit la période de garde tant que l'IA n'a pas de crédit ; l'IA pourra la corriger.
  // La bible d'abord : la garde vient de la bible, sauf une garde saisie par l'utilisateur.
  L.prefillFromBible(nw, S.bible, fenetreRang);
  L.prefillReperes(nw, repereVin, accordsRepere);
  const dup = S.wines.find(w => L.keyOf(w) === L.keyOf(nw));
  if (dup) {
    const c = await ask('Déjà dans votre cave', `« ${dup.name}${dup.year ? ' ' + dup.year : ''} » existe déjà (${dup.qty} bouteille(s)).`, [
      { label: `Ajouter ${nw.qty} bouteille(s) à ce vin`, value: 'add' },
      { label: 'Créer une fiche séparée', value: 'new', kind: 'o' },
      { label: 'Annuler', value: null, kind: 'o' },
    ]);
    if (!c) return;
    if (c === 'add') {
      dup.qty += nw.qty; dup.updated = now;
      const ok = await persist(() => store.putWines([dup]));
      finishSave(dup, ok, `« ${dup.name} » : ${dup.qty} bouteille(s).`);
      return;
    }
  }
  S.wines.push(nw);
  const ok = await persist(() => store.putWines([nw]));
  if (ok) { if ($('#fT').textContent === 'Ajouter un vin') Stats.track('add_manuel'); Stats.noteWines(S.wines.filter(w => !isDemo(w)).length); }
  finishSave(nw, ok, '« ' + nw.name + ' » enregistré dans votre cave.');
}

function finishSave(w, ok, msg) {
  closeSheet('sForm');
  // Le vin qui vient d'être enregistré passe en tête de la passe IA, si l'IA a encore du crédit (la bible reste la base).
  if (ok && AI.geminiPerso()) { autoPrio = w.id; setTimeout(() => autoStep(), 1500); }
  S.tab = 'cave'; S.filt = 'Tous'; S.q = ''; $('#q').value = '';
  const pos = L.sortWines(S.wines, S.sort, YEAR).findIndex(x => x.id === w.id);
  if (pos >= S.limit) S.limit = Math.ceil((pos + 1) / PAGE) * PAGE;
  S.highlight = w.id;
  render();
  if (ok) toast('✅ ' + msg);
  const el = document.querySelector(`.w[data-id="${CSS.escape(w.id)}"]`);
  if (el) el.scrollIntoView({ block: 'center' });
  setTimeout(() => { if (S.highlight === w.id) { S.highlight = null; const e = document.querySelector(`.w[data-id="${CSS.escape(w.id)}"]`); if (e) e.classList.remove('hl'); } }, 2500);
}

async function genInForm() {
  const f = readForm();
  if (!f.name && !f.dom) { errToast('Indiquez au moins le nom ou le domaine.'); F('name').focus(); return; }
  if (!requireAIPerso()) return;
  const b = F('gen'); b.disabled = true; b.textContent = 'Génération en cours…';
  try {
    const d = await AI.makeFiche({ ...f, year: f.year });
    F('grape').value = d.grape; F('story').value = d.story;
    F('from').value = num(d.from); F('to').value = num(d.to);
    F('pairings').value = d.pairings.join(', ');
    S.formExtra.conf = d.conf; S.formExtra.sources = d.sources;
    S.formExtra.aiGen = { grape: F('grape').value.trim(), story: F('story').value.trim(), from: readForm().from, to: readForm().to, pairings: readForm().pairings };
    Stats.track('fiches_ia'); if (d.conf === 'vérifiée') Stats.track('fiches_verif');
    // 1.40.0 : une seule génération par vin (le bouton disparaît) ; l'histoire écrite reste « à relire ».
    S.formExtra.genOk = true; S.formExtra.aiStory = F('story').value.trim(); S.formExtra.relu = false;
    b.hidden = true;
    majRelecture();
    toast(ficheMsg(d));
  } catch (e) { if (!(e && e.name === 'AbortError')) errToast(AI.errText(e)); }
  b.disabled = false; b.textContent = '✨ Générer la fiche avec l’assistant';
}

/* ============ Menu « Actions » d’une carte ============ */
// Un seul bouton sur la carte (loin des + et −) ; Modifier, Noter, Fiche IA et Supprimer sont dans une fenêtre.
// Les vrais boutons restent dans la carte (masqués) : le menu les déclenche, la logique n’est pas dupliquée.
let actId = null;
function openActions(w, card) {
  actId = w.id;
  $('#acN').textContent = w.name + (w.year ? ' ' + w.year : '');
  const has = sel => !!card.querySelector(sel);
  $$('#sAct [data-x]').forEach(b => { b.hidden = !has(`[data-a="${b.dataset.x}"]`); });
  $('#acSep').hidden = $('#sAct [data-x="d"]').hidden;
  openSheet('sAct');
}
function runAction(x) {
  const card = $$('#list .w, #blist .w').find(c => c.dataset.id === actId);
  const real = card && card.querySelector(`[data-a="${x}"]`);
  closeSheet('sAct');
  if (!real) { errToast('Ce vin n’est plus affiché : rouvrez ses actions depuis la liste.'); return; }
  if (x === 'gen') toast('Génération de la fiche en cours…');
  real.click();
}

/* ============ Actions sur les fiches ============ */
async function onCardAction(e) {
  const btn = e.target.closest('[data-a],[data-m]');
  if (!btn) return;
  if (btn.dataset.m) return menuAction(btn.dataset.m);
  const a = btn.dataset.a;
  if (a === 'more') { S.limit += PAGE; renderList(); return; }
  const card = btn.closest('.w'); if (!card) return;
  const w = S.wines.find(x => x.id === card.dataset.id); if (!w) return;
  if (a === 'menu') { openActions(w, card); return; }
  if (a === 'p' || a === 'm') {
    const before = w.qty;
    w.qty = Math.max(0, w.qty + (a === 'p' ? 1 : -1));
    if (w.qty === before) return;
    if (a === 'm') Stats.track('conso');
    w.updated = Date.now();
    render();
    await persist(() => store.putWines([w]));
  } else if (a === 'recalc') {
    const avant = JSON.parse(JSON.stringify(w));
    const c = await ask('Recalculer cette garde ?', `Vos dates ${w.from}–${w.to} seront remplacées par celles de la bible ou du calcul de l’appli. Vous pourrez annuler.`, [
      { label: 'Recalculer', value: 'yes' }, { label: 'Annuler', value: null, kind: 'o' }]);
    if (c !== 'yes') return;
    if (!L.recalculerGarde(w, S.bible, fenetreRang)) {
      if (horsBibleBrut(w)) { await chercherHB(w); return; }
      errToast('Ni la bible ni le calcul ne donnent de garde pour ce vin : vos dates sont conservées.'); return;
    }
    w.updated = Date.now();
    S.ouvert.add(w.id); render();
    if (await persist(() => store.putWines([w]))) {
      toast(`Garde recalculée : ${w.from}–${w.to}.`, { action: { label: 'Annuler', fn: async () => {
        for (const k of ['from', 'to', 'src', 'gv', 'conf', 'updated']) { if (avant[k] === undefined) delete w[k]; else w[k] = avant[k]; }
        S.ouvert.add(w.id); render();
        if (await persist(() => store.putWines([w]))) toast('Dates précédentes rétablies.');
      } } });
    }
  } else if (a === 'hb') {
    await chercherHB(w);
  } else if (a === 'e') {
    openForm(w);
  } else if (a === 'd') {
    const c = await ask('Supprimer ce vin ?', `« ${w.name}${w.year ? ' ' + w.year : ''} » et sa fiche seront retirés de la cave.`, [
      { label: 'Supprimer', value: 'yes', kind: 'danger' }, { label: 'Annuler', value: null, kind: 'o' }]);
    if (c !== 'yes') return;
    const idx = S.wines.indexOf(w);
    S.wines.splice(idx, 1); render();
    if (await persist(() => store.deleteWines([w.id]))) {
      toast('« ' + w.name + ' » supprimé.', { action: { label: 'Annuler', fn: async () => {
        S.wines.splice(Math.min(idx, S.wines.length), 0, w); render();
        if (await persist(() => store.putWines([w]))) toast('Suppression annulée.');
      } } });
    }
  } else if (a === 'relu') {
    const copie = JSON.parse(JSON.stringify(w));
    copie.histRelue = Date.now(); copie.updated = copie.histRelue;
    const idx = S.wines.indexOf(w);
    S.wines[idx] = copie;
    S.ouvert.add(copie.id);
    if (await persist(() => store.putWines([copie]))) { render(); toast('Histoire relue : l’assistant ne la réécrira plus.'); } else { S.wines[idx] = w; render(); }
  } else if (a === 'dg') {
    openTasting(w);
  } else if (a === 'dgdel') {
    const i = Number(btn.dataset.i);
    if (!Array.isArray(w.tastings) || !w.tastings[i]) return;
    const c = await ask('Supprimer cette dégustation ?', 'Cette note sera retirée du journal de ce vin.', [
      { label: 'Supprimer', value: 'yes', kind: 'danger' }, { label: 'Annuler', value: null, kind: 'o' }]);
    if (c !== 'yes') return;
    const copie = JSON.parse(JSON.stringify(w));
    copie.tastings.splice(i, 1); copie.updated = Date.now();
    const idx = S.wines.indexOf(w);
    S.wines[idx] = copie;
    if (await persist(() => store.putWines([copie]))) { render(); toast('Dégustation supprimée.'); } else { S.wines[idx] = w; render(); }
  } else if (a === 'gen') {
    if (!requireAIPerso()) return;
    btn.disabled = true; btn.textContent = 'Génération…';
    try {
      const d = await AI.makeFiche(w);
      if (!d.story && !d.pairings.length && !d.grape) { btn.disabled = false; btn.textContent = '✨ Fiche par l’assistant'; errToast('L’assistant a répondu sans fiche exploitable pour ce vin. Réessayez dans un instant ; si cela se répète, vérifiez votre clé dans ⚙ Réglages.'); return; }
      Stats.track('fiches_ia'); if (d.conf === 'vérifiée') Stats.track('fiches_verif');
      const c = copieIA(w, d);
      if (await persist(() => store.putWines([c]))) {
        remplace(w, c);
        const chg = ['grape', 'story', 'from', 'to'].some(k => w[k] !== c[k]) || JSON.stringify(w.pairings) !== JSON.stringify(c.pairings);
        S.highlight = c.id; S.ouvert.add(c.id);
        render();
        const el = document.querySelector(`.w[data-id="${CSS.escape(c.id)}"]`);
        if (el) el.scrollIntoView({ block: 'center' });
        setTimeout(() => { if (S.highlight === c.id) { S.highlight = null; const e2 = document.querySelector(`.w[data-id="${CSS.escape(c.id)}"]`); if (e2) e2.classList.remove('hl'); } }, 2500);
        toast(chg ? '✅ ' + ficheMsg(d) + ' Ouvrez « Fiche et accords » pour la lire.' : 'La fiche est déjà à jour : l’assistant n’a rien trouvé à changer (vos saisies sont conservées).');
        return;
      }
      render();
    } catch (err) { btn.disabled = false; btn.textContent = '✨ Fiche par l’assistant'; errToast(AI.errText(err)); }
  }
}

// Un seul message (demande de Jeff, 28 octobre 2026). Recherche web en pause : « vérifiée » n'arrive que si on la réactive.
function ficheMsg(d) {
  if (d.conf === 'vérifiée') return `Fiche vérifiée sur le web (${d.sources.length} source${d.sources.length > 1 ? 's' : ''}).`;
  return 'Fiche mise à jour par l’assistant.';
}

// L'IA met à jour une copie du vin (jamais l'objet partagé), puis la copie remplace l'original une fois enregistrée.
function copieIA(w, d) { return L.applyAi(JSON.parse(JSON.stringify(w)), d); }
function remplace(w, c) { const i = S.wines.indexOf(w); if (i >= 0) S.wines[i] = c; }

// Fonctions autres que la lecture d'étiquette (fiches, valeur…) : clé personnelle, ou relais offert sous sa limite du jour.
function requireAIPerso() {
  if (AI.iaDispo()) return true;
  if (AI.relaisEpuise()) { limiteWindow(); return false; }
  if (AI.ready() || AI.limiteAtteinte()) { errToastReglages(AI.errText({ code: 'cle_perso' })); return false; }
  return requireAI();
}
function requireAI() {
  if (AI.scanDispo()) return true;
  if (AI.limiteAtteinte()) { limiteWindow(true); return false; }
  if (AI.ready()) { errToastReglages(AI.errText({ code: 'cle_perso' })); return false; }
  errToast(AI.ERR.no_key);
  openSettings();
  return false;
}
// Fenêtre affichée quand la limite du jour est atteinte et qu'aucune clé personnelle n'est saisie.
async function limiteWindow(scan) {
  await whenFree();
  const c = await ask('Limite du jour atteinte', scan
    ? 'Vous avez utilisé la lecture d’étiquette gratuite d’aujourd’hui : elle est limitée à une photo par jour et revient demain. Pour lire autant d’étiquettes que vous voulez, activez votre propre clé gratuite Gemini (environ 2 minutes, sans carte bancaire).'
    : `Vous avez utilisé l’IA offerte d’aujourd’hui : elle est limitée à ${AI.LIMITE_RELAIS} vins par jour et revient demain. Pour l’utiliser sans limite, activez votre propre clé gratuite Gemini (environ 2 minutes, sans carte bancaire).`,
    [{ label: 'Plus tard', value: 'plus', kind: 'o' }, { label: 'Activer ma clé gratuite', value: 'cle' }]);
  if (c === 'cle') openCle();
}

/* ============ Activation de la clé gratuite : encarts (jamais bloquants) et feuille en 3 étapes ============ */
const CLE_URL = 'https://aistudio.google.com/app/apikey';
const INVIT_K = 'cave-cle-invit', REPRISE_K = 'cave-cle-etape';
const lsGet = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* stockage bloqué : sans gravité, on garde en mémoire */ } };
const lsDel = k => { try { localStorage.removeItem(k); } catch (e) { /* sans effet */ } };
let invitMem = null, photoEchec = null, cleCandidate = '', cleBusy = false;
const invitLire = () => invitMem || Cle.lireInvit(lsGet(INVIT_K));
const invitEcrire = e => { invitMem = e; lsSet(INVIT_K, JSON.stringify(e)); };
const jourIso = () => new Date().toISOString().slice(0, 10);

const ENC = {
  b: { titre: 'Votre photo gratuite du jour est utilisée', corps: 'Pour en lire d’autres aujourd’hui, activez votre clé gratuite (environ 2 minutes, sans carte bancaire). Sinon, la saisie à la main fonctionne très bien.' },
  c1menu: { titre: 'Plus de photo gratuite aujourd’hui', corps: 'Elle revient demain. Pour continuer maintenant, activez votre clé gratuite (environ 2 minutes), ou saisissez vos vins à la main.' },
  c1photo: { titre: 'Plus de photo gratuite aujourd’hui', corps: 'Elle revient demain. Pour continuer maintenant, activez votre clé gratuite (environ 2 minutes), ou saisissez ce vin à la main : votre photo reste affichée pour vous aider.' },
  c1lot: { titre: 'Plus de photo gratuite aujourd’hui', corps: 'Elle revient demain. Pour continuer maintenant, activez votre clé gratuite (environ 2 minutes), ou saisissez vos vins à la main.' },
  c2: { titre: 'Le service de photo gratuit est saturé', corps: 'Ce n’est pas de votre fait. Réessayez plus tard, activez votre clé gratuite, ou saisissez ce vin à la main.' },
  revoquee: { titre: 'Google ne reconnaît plus votre clé', corps: 'Elle a peut-être été supprimée. Remplacez-la, ou saisissez à la main : les fiches continuent avec l’aide offerte.' },
  limitePerso: { titre: 'Limite de Google atteinte', corps: 'Google a atteint sa limite du jour pour votre clé. Elle revient demain. En attendant, saisissez à la main.' },
};
function paintEnc(el, { titre, corps, actions = [], croix = '' }) {
  el.className = 'enc' + (croix ? ' cx' : '');
  el.innerHTML = (croix ? `<button class="x" type="button" data-enc="${croix}" aria-label="Fermer">×</button>` : '')
    + (titre ? `<b>${esc(titre)}</b>` : '') + `<p>${esc(corps)}</p>`
    + (actions.length ? `<div class="stack">${actions.map(a => `<button class="btn${a.o ? ' o' : ''}" type="button" data-enc="${a.a}">${esc(a.label)}</button>`).join('')}</div>` : '');
  el.hidden = false;
}
const ACT_CLE = { a: 'cle', label: 'Activer ma clé gratuite' }, ACT_MAIN = { a: 'main', label: 'Saisir à la main', o: true };
// Encart du menu d'ajout : A (une ligne discrète, permanente) tant que la photo du jour est disponible, C1 quand elle est utilisée.
function renderMenuEnc() {
  const el = $('#m-enc'); if (!el) return;
  const e = AI.etatPhoto();
  // Photo gratuite du jour utilisée : les deux boutons de photo sont grisés (le message explique pourquoi).
  $$('#sMenu [data-m="cam"], #sMenu [data-m="img"]').forEach(b => { b.classList.toggle('indispo', e === 'limite'); b.setAttribute('aria-disabled', e === 'limite' ? 'true' : 'false'); });
  if (e === 'gratuit') {
    el.className = 'enc mini';
    el.innerHTML = '<p class="mu small">1 photo gratuite par jour. Plus avec votre propre clé.</p><button class="lnk" type="button" data-enc="cle">Activer ma clé gratuite</button>';
    el.hidden = false;
  } else if (e === 'limite') paintEnc(el, { ...ENC.c1menu, actions: [ACT_CLE, ACT_MAIN] });
  else el.hidden = true;
}
// Encart B : juste après la photo gratuite du jour, au plus une fois par jour et 3 fois au total (voir cle.js).
function encartB() {
  if (AI.geminiPerso() || !Cle.peutAfficherB(invitLire(), jourIso(), Date.now())) return;
  invitEcrire(Cle.noterB(invitLire(), jourIso()));
  paintEnc($('#f-enc'), { ...ENC.b, actions: [ACT_CLE], croix: 'fermerB' });
}
// Encart C (ou clé révoquée / limite de Google) dans la fenêtre d'analyse, selon la cause réelle de l'échec.
function encartLog(e, unePhoto) {
  const el = $('#lgEnc'); if (!el || !e) return;
  const c = e.code, perso = AI.geminiPerso();
  if (!perso && (c === 'limite_gratuite' || c === 'service_gratuit' || c === 'cle_perso')) {
    const limite = AI.etatPhoto() === 'limite';
    paintEnc(el, { ...(limite ? (unePhoto ? ENC.c1photo : ENC.c1lot) : ENC.c2), actions: [ACT_CLE] });
  } else if (perso && c === 'bad_key') paintEnc(el, { ...ENC.revoquee, actions: [{ a: 'cle', label: 'Remplacer ma clé' }] });
  else if (perso && c === 'rate_limited') paintEnc(el, ENC.limitePerso);
}
function effacerPhotoForm() {
  const i = $('#f-photo'); if (!i) return;
  if (i.dataset.u) { try { URL.revokeObjectURL(i.dataset.u); } catch (e) { /* sans effet */ } i.dataset.u = ''; }
  i.removeAttribute('src'); $('#f-photo-w').hidden = true;
}
function montrerPhotoForm(file) {
  try { const u = URL.createObjectURL(file); const i = $('#f-photo'); i.dataset.u = u; i.src = u; $('#f-photo-w').hidden = false; } catch (e) { /* la saisie reste possible sans l'aperçu */ }
}
function majGuideCle() {
  const a = !!AI.getConfig('gemini').key;
  $('#ai-guide').hidden = a; $('#ai-repl').hidden = !a;
}
// Après la feuille d'activation (fermée par n'importe quel geste) : tout ce qui dépend de la clé est remis à jour.
function apresCle() {
  renderMenuEnc(); majGuideCle();
  if (AI.geminiPerso()) { $('#f-enc').hidden = true; $('#lgEnc').hidden = true; }
  if ($('#sSet').classList.contains('show')) { const s = AI.getSettings(); renderAiChoices(s.provider); fillAiFields(s.provider); $('#ai-key').type = 'password'; $('#ai-show').textContent = 'Voir'; }
}

function cleEtape(n) {
  [1, 2, 3].forEach(i => { $('#cle-' + i).hidden = i !== n; });
  $('#cle-stp').textContent = `Étape ${n} sur 3 · ${['', 'Obtenir ma clé', 'Coller ma clé', 'Tester ma clé'][n]}`;
  if (n !== 3) { $('#cle-res').hidden = true; $('#cle-fin').hidden = true; $('#cle-test').hidden = false; }
}
// ---- Vin hors de la bible : l'IA propose la région et la garde, la personne valide ----
// Hors bible = aucune ligne dans la bible et appellation/région non reconnue par le calcul (vin étranger, cuvée inconnue).
// Une garde déjà décidée (acceptée de l’IA ou saisie par vous) fait disparaître l’encart.
const gardeDecidee = w => !!(w && w.from && w.to && w.src && (w.src.from === 'ai' || w.src.from === 'user'));
const horsBibleBrut = w => !!(w && w.name && w.year && !L.bibleEntry(w, S.bible) && apogee(w, YEAR).connue === false);
const horsBible = w => horsBibleBrut(w) && !gardeDecidee(w);
const hbEncartHtml = () => '<div class="enc hb"><b>Vin hors de la bible</b><p>La bible ne couvre que la France. L’assistant peut proposer la région et une garde (fiabilité faible, à vérifier). Rien n’est écrit sans votre accord.</p><button class="btn" data-a="hb" type="button">Chercher avec l’assistant</button></div>';
let hbBusy = false;
async function chercherHB(w) {
  if (hbBusy) return;
  hbBusy = true;
  try {
    let r;
    try { r = await AI.chercherGarde(w); }
    catch (e) {
      if (e && e.name === 'AbortError') return;
      const c = e && e.code;
      const hors = typeof navigator !== 'undefined' && navigator.onLine === false;
      const sansIA = hors || (!AI.geminiPerso() && ['no_key', 'limite_gratuite', 'cle_perso', 'rate_limited', 'network'].includes(c));
      if (!sansIA) { errToast(AI.errText(e)); return; }
      const v = await ask('Recherche impossible pour le moment',
        hors ? 'Pas de connexion. Vos dates sont conservées. Vous pourrez réessayer plus tard.'
          : 'L’assistant offert a atteint sa limite du jour. Vos dates sont conservées. Vous pouvez réessayer demain, ou activer votre clé gratuite.',
        hors ? [{ label: 'Garder mes dates', value: null }]
          : [{ label: 'Activer ma clé gratuite', value: 'cle' }, { label: 'Garder mes dates', value: null, kind: 'o' }]);
      if (v === 'cle') openCle();
      return;
    }
    const actuel = w.from && w.to ? `${w.from}–${w.to}` : 'aucune';
    const base = AI.getConfig('gemini').key && r.searched ? 'avec recherche web (Gemini)' : 'à partir des connaissances de l’IA, sans recherche web';
    const c = await ask('Proposition de l’assistant',
      `Région : ${r.region || 'non précisée'}\nGarde : ${r.from}–${r.to}\nVos dates actuelles : ${actuel}\n\nFiabilité faible : estimation ${base}. À vérifier.`,
      [{ label: 'Appliquer cette proposition', value: 'yes' }, { label: 'Garder mes dates', value: null, kind: 'o' }]);
    if (c !== 'yes') return;
    const avant = JSON.parse(JSON.stringify(w));
    if (r.region && !w.region) w.region = r.region; // jamais d'écrasement d'une région saisie
    w.from = r.from; w.to = r.to;
    w.src = { ...(w.src || {}), from: 'ai', to: 'ai' };
    w.gv = { from: r.from, to: r.to, k: 'x' };
    w.conf = 'estimée';
    w.updated = Date.now();
    S.ouvert.add(w.id); render();
    if (await persist(() => store.putWines([w]))) {
      toast(`Garde proposée par l’assistant : ${w.from}–${w.to}.`, { action: { label: 'Annuler', fn: async () => {
        for (const k of ['from', 'to', 'src', 'gv', 'conf', 'region', 'updated']) { if (avant[k] === undefined) delete w[k]; else w[k] = avant[k]; }
        S.ouvert.add(w.id); render();
        if (await persist(() => store.putWines([w]))) toast('Dates précédentes rétablies.');
      } } });
    }
  } finally { hbBusy = false; }
}

function openCle() {
  cleCandidate = ''; cleBusy = false;
  const ch = $('#cle-champ'); ch.value = ''; ch.type = 'password'; $('#cle-voir').textContent = 'Voir'; $('#cle-err').hidden = true;
  const remplace = AI.geminiPerso();
  $('#cleT').textContent = remplace ? 'Remplacer ma clé' : 'Activer ma clé gratuite';
  $('#cle-ancienne').hidden = !remplace;
  cleEtape(Cle.lireReprise(lsGet(REPRISE_K), Date.now()) === 2 ? 2 : 1);
  openSheet('sCle');
}
function cleSuite() {
  const r = Cle.nettoyerCle($('#cle-champ').value);
  const err = $('#cle-err');
  if (r.err) {
    err.textContent = r.err === 'vide' ? 'Collez d’abord votre clé.' : 'Cette clé semble incomplète. Recopiez-la en entier, sans espace.';
    err.hidden = false; $('#cle-champ').focus(); return;
  }
  err.hidden = true; cleCandidate = r.cle; $('#cle-champ').value = r.cle;
  $('#cle-apercu').textContent = Cle.masquerCle(r.cle);
  cleEtape(3);
}
function cleResultat(txt, kind, actions) {
  const r = $('#cle-res'); r.textContent = txt; r.className = 'res' + (kind ? ' ' + kind : ''); r.hidden = false;
  const f = $('#cle-fin');
  f.innerHTML = actions.map(a => `<button class="btn${a.o ? ' o' : ''}" type="button" data-cle="${a.a}">${esc(a.label)}</button>`).join('');
  f.hidden = false; $('#cle-test').hidden = true;
}
async function cleTester() {
  if (cleBusy || !cleCandidate) return;
  cleBusy = true;
  const b = $('#cle-test'); b.hidden = false; b.disabled = true; b.textContent = 'Test en cours…';
  $('#cle-res').hidden = true; $('#cle-fin').hidden = true;
  let r; try { r = await AI.testerCleGemini(cleCandidate); } catch (e) { r = { etat: 'indispo' }; }
  cleBusy = false; b.disabled = false; b.textContent = 'Tester ma clé';
  const ENREG = [{ a: 'photo', label: 'Photographier une étiquette' }, { a: 'fin', label: 'Terminer', o: true }];
  const REESSAI = [{ a: 'reprendre', label: 'Réessayer' }, { a: 'nouvelle', label: 'Créer une nouvelle clé', o: true }, { a: 'main', label: 'Saisir à la main', o: true }];
  const RETESTER = { a: 'retester', label: 'Réessayer' };
  if (r.etat === 'refusee') { cleResultat('❌ Google a refusé cette clé. Vérifiez qu’elle est copiée en entier, ou créez-en une nouvelle.', 'ko', REESSAI); return; }
  if (r.etat === 'indispo') { cleResultat('Google ne répond pas correctement pour le moment. Réessayez dans un instant.', 'att', [RETESTER, REESSAI[2]]); return; }
  // Clé valide (ou impossible à tester maintenant) : elle est enregistrée ; l'ancienne reste active jusqu'ici.
  try { AI.setSettings({ provider: 'gemini', key: cleCandidate, model: AI.getConfig('gemini').model, base: '' }); }
  catch (e) { cleResultat('❌ Enregistrement impossible : le stockage du navigateur est bloqué. Votre clé n’a pas été enregistrée.', 'ko', [RETESTER, REESSAI[2]]); return; }
  lsDel(REPRISE_K); cleCandidate = '';
  if (r.etat === 'ok') cleResultat('✅ Clé activée. L’appli ne fixe plus de limite pour vos photos ; seul le quota gratuit de Google s’applique.', '', ENREG);
  else if (r.etat === 'limite') cleResultat('✅ Clé valide. Google a atteint sa limite pour le moment : elle fonctionnera de nouveau plus tard.', '', [{ a: 'fin', label: 'Terminer' }]);
  else cleResultat('Pas de réseau : impossible de tester maintenant. Votre clé est enregistrée ; elle sera vérifiée à votre prochaine photo.', 'att', [{ a: 'fin', label: 'Terminer' }]);
  apresCle();
}
function initCle() {
  // Boutons des encarts (menu, fiche, fenêtre d'analyse) : un seul écouteur, jamais de fenêtre bloquante.
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-enc]'); if (!b) return;
    const a = b.dataset.enc;
    if (a === 'cle') openCle();
    else if (a === 'main') { closeSheet('sMenu'); openForm(null); }
    else if (a === 'fermerB') { invitEcrire(Cle.fermerB(invitLire(), Date.now())); $('#f-enc').hidden = true; }
  });
  $('#cle-fin').addEventListener('click', e => {
    const b = e.target.closest('[data-cle]'); if (!b) return;
    const a = b.dataset.cle;
    if (a === 'retester') cleTester();
    else if (a === 'reprendre') { $('#cle-err').hidden = true; cleEtape(2); $('#cle-champ').focus(); }
    else if (a === 'nouvelle') { lsDel(REPRISE_K); cleEtape(1); }
    else if (a === 'main') { hideSheet('sCle'); closeSheet('sMenu'); openForm(null); }
    else if (a === 'fin') closeSheet('sCle');
    else if (a === 'photo') { hideSheet('sCle'); menuAction('cam'); }
  });
  $('#cle-open').onclick = () => {
    lsSet(REPRISE_K, JSON.stringify({ etape: 2, t: Date.now() }));
    try { window.open(CLE_URL, '_blank', 'noopener,noreferrer'); } catch (e) { errToast('Ouvrez aistudio.google.com dans votre navigateur.'); return; }
    cleEtape(2);
  };
  $('#cle-copy').onclick = async () => { try { await navigator.clipboard.writeText(CLE_URL); toast('Adresse copiée. Collez-la dans votre navigateur.'); } catch (e) { errToast('Copie impossible : ouvrez aistudio.google.com dans votre navigateur.'); } };
  $('#cle-have').onclick = () => cleEtape(2);
  $('#cle-retour1').onclick = () => cleEtape(1);
  $('#cle-voir').onclick = () => { const k = $('#cle-champ'); const v = k.type === 'password'; k.type = v ? 'text' : 'password'; $('#cle-voir').textContent = v ? 'Masquer' : 'Voir'; };
  $('#cle-coller').onclick = async () => {
    let t = '';
    try { t = (await navigator.clipboard.readText()) || ''; }
    catch (e) { const er = $('#cle-err'); er.textContent = 'Collage impossible : touchez le champ, maintenez le doigt et choisissez « Coller ».'; er.hidden = false; $('#cle-champ').focus(); return; }
    $('#cle-champ').value = t; cleSuite();
  };
  $('#cle-suite').onclick = cleSuite;
  $('#cle-champ').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); cleSuite(); } });
  $('#cle-test').onclick = cleTester;
  $('#ai-pas').onclick = openCle;
  $('#ai-repl').onclick = openCle;
}

/* ============ Suivi des traitements longs ============ */
function openLog(title, names, hint) {
  const rows = names.map(n => ({ name: n, st: 'wait', msg: 'En attente' }));
  const ac = new AbortController();
  const log = {
    rows, signal: ac.signal, stopped: false, done: false,
    set(i, st, msg) { rows[i].st = st; rows[i].msg = msg; paint(); },
    finish(t) { log.done = true; logRunning = false; $('#lgT').textContent = t; $('#lgH').textContent = ''; $('#lgStop').hidden = true; $('#lgX').hidden = false; $('#lgMan').hidden = !log.manual; paint(); },
  };
  const icon = { wait: '⏳', ok: '✅', dup: '➕', err: '❌', skip: '⏸️' };
  function paint() {
    $('#lg').innerHTML = rows.map(r => `<div class="lr">${r.st === 'run' ? '<div class="sp" aria-hidden="true"></div>' : '<span aria-hidden="true">' + icon[r.st] + '</span>'}<div><b>${esc(r.name)}</b><small>${esc(r.msg)}</small></div></div>`).join('');
  }
  $('#lgT').textContent = title; $('#lgH').textContent = hint || '';
  $('#lgStop').hidden = false; $('#lgStop').disabled = false; $('#lgX').hidden = true; $('#lgMan').hidden = true; $('#lgEnc').hidden = true;
  $('#lgStop').onclick = () => { log.stopped = true; ac.abort(); $('#lgStop').disabled = true; };
  logRunning = true;
  paint();
  openSheet('sLog');
  return log;
}

/* ============ Scan d'étiquettes ============ */
async function scanFiles(files) {
  files = [...files];
  if (!files.length || !requireAI()) return;
  const etatAvant = AI.etatPhoto();   // « gratuit » : c'est la photo gratuite du jour
  photoEchec = null; let derniereErr = null;
  const log = openLog(`Analyse de ${files.length} photo(s)…`, files.map((f, i) => f.name || 'Photo ' + (i + 1)), 'Chaque photo prend 5 à 30 secondes. Gardez l’appli ouverte.');
  let added = 0, dups = 0, fails = 0, single = null;
  // Avec une clé personnelle, la photo suivante est lue pendant que la précédente est enregistrée (2 lectures à la fois au plus).
  // Les résultats sont traités dans l’ordre : la détection des doublons ne change pas. Clé gratuite partagée : une seule à la fois.
  const prefetch = AI.avisPossible();
  const lus = [];
  const lire = i => lus[i] || (lus[i] = AI.scanLabel(files[i], { signal: log.signal, onWait: s => log.set(i, 'run', `Limite de l’IA atteinte, nouvel essai dans ${s} s…`) }).then(d => ({ d }), e => ({ e })));
  for (let i = 0; i < files.length; i++) {
    if (log.stopped) { for (let j = i; j < files.length; j++) log.set(j, 'skip', 'Non traité (arrêté)'); break; }
    log.set(i, 'run', 'Lecture de l’étiquette…');
    try {
      const p = lire(i);
      if (prefetch && i + 1 < files.length) lire(i + 1);
      const res = await p;
      if (res.e) throw res.e;
      const d = res.d;
      const w = L.normalizeWine({ ...d, qty: 1, check: d.lecture !== 'haute' });
      const label = [w.name, w.dom, w.year].filter(Boolean).join(' · ');
      // Durée de la lecture (photo + IA), pour juger la vitesse ; « lecture précise » si le modèle léger a hésité.
      const tm = d.timing ? ` (${((d.timing.prep + d.timing.appel) / 1000).toFixed(1).replace('.', ',')} s${d.timing.precis ? ', lecture précise' : ''})` : '';
      const ex = S.wines.find(x => L.keyOf(x) === L.keyOf(w));
      if (ex) {
        ex.qty += 1; ex.updated = Date.now(); dups++;
        const ok = await persist(() => store.putWines([ex]));
        log.set(i, ok ? 'dup' : 'err', ok ? `Déjà en cave : ${label} (${ex.qty} bouteilles)${tm}` : 'Lu, mais non enregistré (mémoire pleine)');
      } else if (files.length === 1) {
        single = w; log.set(i, 'ok', 'Reconnu : ' + label + tm);
      } else {
        S.wines.push(w); added++;
        const ok = await persist(() => store.putWines([w]));
        log.set(i, ok ? 'ok' : 'err', ok ? 'Ajouté : ' + label + (w.check ? ' (à vérifier)' : '') + tm : 'Lu, mais non enregistré (mémoire pleine)');
      }
      render();
    } catch (e) {
      if (e && e.name === 'AbortError') { log.set(i, 'skip', 'Arrêté'); continue; }
      fails++; derniereErr = e; log.set(i, 'err', AI.errText(e));
      if (e && (e.code === 'rate_limited' || e.code === 'limite_gratuite' || e.code === 'service_gratuit' || e.code === 'bad_key' || e.code === 'no_key' || e.code === 'bad_model' || e.code === 'network')) {
        for (let j = i + 1; j < files.length; j++) log.set(j, 'skip', 'Non traité');
        break;
      }
    }
  }
  if (files.length > 1) Stats.track('add_photos', added); else if (single) Stats.track('add_scan');
  Stats.noteWines(S.wines.filter(w => !isDemo(w)).length + (single ? 1 : 0));
  log.manual = fails > 0;
  if (fails > 0 && files.length === 1) photoEchec = files[0];
  log.finish(single ? 'Étiquette reconnue' : `Terminé : ${added} ajouté(s), ${dups} doublon(s), ${fails} échec(s)`);
  if (derniereErr) encartLog(derniereErr, files.length === 1);
  if (single) { hideSheet('sLog'); openForm(single, 'Vérifier la fiche scannée'); if (etatAvant === 'gratuit' && AI.etatPhoto() === 'limite') encartB(); }
}

/* ============ Fiches par lots ============ */
// Avis sur l’équilibre : relancé seulement quand un vin est ajouté ou supprimé, en fond. Sans crédit, l’avis précédent reste affiché.
let avisMem = null;          // { texte, date, cle, erreur } (sauvegardé dans la base de l’appli)
let avisEnCours = false;
let avisCleVue = null;       // empreinte de la cave à la dernière demande
let avisTimer = null;
let prenomMem = '';
const cleCave = () => {
  const s = S.wines.map(w => w.id).sort().join('|');
  let h = 5381; for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
  return S.wines.length + ':' + h.toString(36);
};
const renderSiMagic = () => { if (S.tab === 'chiffres') renderChiffres(); };
const ecartAvis = () => { const avant = new Set(avisMem.ids), now = new Set(S.wines.map(w => String(w.id))); let n = 0; for (const i of now) if (!avant.has(i)) n++; for (const i of avant) if (!now.has(i)) n++; return n; };
function avisSiChange() {
  if (!S.wines.length || !AI.avisPossible()) return;
  const cle = cleCave();
  if (cle === avisCleVue) return;
  // L'avis ne se refait que si au moins 2 vins ont été ajoutés ou retirés depuis le dernier (même version de l'appli).
  if (avisMem && avisMem.v === VERSION && Array.isArray(avisMem.ids) && ecartAvis() < 2) return;
  avisCleVue = cle;
  clearTimeout(avisTimer);
  avisTimer = setTimeout(() => genererAvis(), 2500);
}
async function genererAvis() {
  if (avisEnCours || !S.wines.length || !AI.avisPossible()) return;
  avisEnCours = true; renderSiMagic();
  const cle = cleCave();
  const idsAvis = S.wines.map(w => String(w.id));
  try {
    await whenFree();
    const c = chiffres(S.wines, YEAR);
    const tot = c.bouteilles || 1, pc = n => Math.round(n / tot * 100);
    const fr = c.frise.slice(0, 12);
    const absents = ['Blanc', 'Rosé', 'Pétillant'].filter(k => !c.couleurs.some(x => x[0] === k));
    const resume = {
      annee: YEAR, bouteilles: c.bouteilles, references: c.references,
      couleurs: c.couleurs.map(([k, n]) => ({ couleur: k, bouteilles: n, pct: pc(n) })),
      couleurs_absentes: absents,
      regions: c.regions.slice(0, 8).map(([k, n]) => ({ region: k, bouteilles: n, pct: pc(n) })),
      appellations: c.appellations.slice(0, 8).map(([k, n]) => ({ appellation: k, bouteilles: n, pct: pc(n) })),
      cepages: c.cepages.slice(0, 8).map(([k, n]) => ({ cepage: k, bouteilles: n, pct: pc(n) })),
      millesimes_par_decennie: c.decennies.map(([k, n]) => ({ decennie: k || 'sans millésime', bouteilles: n })),
      statuts: { prets_a_boire: c.statuts.pret, a_garder: c.statuts.garder, urgence: c.statuts.urgence, sans_periode_de_garde: c.statuts.sans },
      a_boire_vite: c.aBoireVite,
      calendrier_a_boire: fr.map(([y, n]) => ({ annee: y, bouteilles: n })),
      annees_creuses_sur_12_ans: fr.filter(x => !x[1]).map(x => x[0]),
      pic_a_boire: c.pic,
      diversite: c.diversite, lecture: L.equilibre(c),
    };
    const rep = await AI.avisCave(resume);
    const { court, complet } = rep;
    const extra = rep.solide ? { cles: rep.cles, solide: rep.solide, manque: rep.manque, priorite: rep.priorite } : {};
    avisMem = { court, complet, ...extra, date: Date.now(), cle, ids: idsAvis, v: VERSION, erreur: '' };
  } catch (e) {
    // Sans crédit ou en panne : on garde l’avis précédent et on dit pourquoi
    avisMem = { ...(avisMem || {}), cle, v: VERSION, erreur: AI.errText(e) };
  }
  try { await store.setMeta('avis', avisMem); } catch (e) { console.error(e); }
  avisEnCours = false; renderSiMagic();
  // la cave a changé pendant la lecture : on relance une fois
  if (cleCave() !== cle) avisSiChange();
}


// Valeur : seulement les vins pas encore estimés, par lots de 10 (sans recherche web).
async function valeurCaveIA() {
  const todo = S.wines.filter(w => w.qty > 0 && !w.estim);
  if (!todo.length) { toast('Toutes les bouteilles sont déjà estimées.'); return; }
  if (!requireAIPerso()) return;
  const calls = Math.ceil(todo.length / 10);
  const c = await ask('Estimer la valeur', `${todo.length} vin(s) à estimer, soit environ ${calls} appel(s) à l’IA. Ce sont des fourchettes indicatives, sans vérification sur le web.`, [
    { label: 'Lancer', value: 'go' }, { label: 'Annuler', value: null, kind: 'o' }]);
  if (c !== 'go') return;
  const groups = []; for (let i = 0; i < todo.length; i += 10) groups.push(todo.slice(i, i + 10));
  const log = openLog('Estimation de la valeur…', groups.map(g => g.map(w => w.name).join(', ').slice(0, 60)), 'Les estimations sont enregistrées au fur et à mesure.');
  let done = 0;
  for (let i = 0; i < groups.length; i++) {
    if (log.stopped) { for (let j = i; j < groups.length; j++) log.set(j, 'skip', 'Non traité (arrêté)'); break; }
    log.set(i, 'run', 'Estimation…');
    try {
      const res = await AI.estimeValeur(groups[i], { signal: log.signal });
      const changed = [];
      for (const w of groups[i]) { const e = res.get(String(w.id)); if (e) { const cp = JSON.parse(JSON.stringify(w)); cp.estim = e; changed.push(cp); } }
      const ok = !changed.length || await persist(() => store.putWines(changed));
      if (ok) changed.forEach(cp => remplace(S.wines.find(x => x.id === cp.id), cp));
      done += changed.length;
      log.set(i, ok ? 'ok' : 'err', ok ? `${changed.length} estimation(s)` : 'Non enregistré (mémoire pleine)');
      render();
    } catch (e) {
      if (e && e.name === 'AbortError') { log.set(i, 'skip', 'Arrêté'); continue; }
      log.set(i, 'err', AI.errText(e));
      if (e && ['rate_limited', 'limite_gratuite', 'service_gratuit', 'bad_key', 'no_key', 'bad_model', 'network'].includes(e.code)) { for (let j = i + 1; j < groups.length; j++) log.set(j, 'skip', 'Non traité'); break; }
    }
  }
  log.finish(`Terminé : ${done} bouteille(s) estimée(s). Relancez plus tard pour les autres.`);
}

async function enrichAll() {
  const todo = S.wines.filter(w => !w.aiPass);
  if (!todo.length) { toast('Toutes les fiches ont déjà été mises à jour par l’assistant.'); return; }
  if (!requireAIPerso()) return;
  const gemini = AI.geminiPerso();
  const calls = Math.ceil(todo.length / 10);
  const c = await ask('Mettre à jour les fiches', `${todo.length} vin(s) à vérifier, soit environ ${calls} appel(s) à l’IA (10 vins par appel). Vous pourrez arrêter à tout moment.`, [
    { label: 'Lancer', value: 'go' }, { label: 'Annuler', value: null, kind: 'o' }]);
  if (c !== 'go') return;
  const taille = 10;
  const groups = []; for (let i = 0; i < todo.length; i += taille) groups.push(todo.slice(i, i + taille));
  const log = openLog('Fiches en cours…', groups.map(g => g.map(w => w.name).join(', ').slice(0, 60)), 'Les fiches sont enregistrées au fur et à mesure.');
  let done = 0;
  for (let i = 0; i < groups.length; i++) {
    if (log.stopped) { for (let j = i; j < groups.length; j++) log.set(j, 'skip', 'Non traité (arrêté)'); break; }
    log.set(i, 'run', 'Rédaction des fiches…');
    try {
      let res;
      res = await AI.makeFiches(groups[i], { signal: log.signal, only: gemini ? 'gemini' : undefined, onWait: s => log.set(i, 'run', `Limite de l’IA atteinte, nouvel essai dans ${s} s…`) });
      const changed = [];
      for (const w of groups[i]) { const d = res.get(String(w.id)); if (d) changed.push([w, copieIA(w, d)]); }
      Stats.track('fiches_ia', changed.length);
      const ok = !changed.length || await persist(() => store.putWines(changed.map(x => x[1])));
      if (ok) changed.forEach(([w, c]) => remplace(w, c));
      done += changed.length;
      log.set(i, ok ? 'ok' : 'err', ok ? `${changed.length} fiche(s) complétée(s) ou corrigée(s)` : 'Non enregistré (mémoire pleine)');
      render();
    } catch (e) {
      if (e && e.name === 'AbortError') { log.set(i, 'skip', 'Arrêté'); continue; }
      log.set(i, 'err', AI.errText(e));
      if (e && ['rate_limited', 'limite_gratuite', 'service_gratuit', 'bad_key', 'no_key', 'bad_model', 'network'].includes(e.code)) { for (let j = i + 1; j < groups.length; j++) log.set(j, 'skip', 'Non traité'); break; }
    }
  }
  log.finish(`Terminé : ${done} fiche(s) complétée(s). Relancez plus tard pour les autres.`);
}

/* ============ Que boire avec un plat ============ */
async function findForDish() {
  const dish = $('#dish').value.trim();
  if (!dish) { errToast('Décrivez le plat prévu.'); $('#dish').focus(); return; }
  const stock = S.wines.filter(w => w.qty > 0);
  if (!stock.length) { $('#blist').innerHTML = '<p class="empty">Aucune bouteille en cave.</p>'; return; }
  Stats.track('plat');
  const local = classerPlat(dish, 5);
  const showLocal = note => {
    $('#blist').innerHTML = `<p class="mu small">${note}</p>` + (local.length ? local.map(r => card(r.w, 'boire', r.why)).join('')
      : '<p class="empty">Aucune suggestion : complétez les accords de vos fiches (✨ Fiche) ou configurez une IA dans Réglages.</p>');
  };
  if (!AI.iaDispo()) { showLocal('Suggestions sans IA, d’après les accords enregistrés et la couleur.'); return; }
  // présélection locale : l'IA ne reçoit que 40 vins au plus, quel que soit la taille de la cave
  const pre = classerPlat(dish, 40).map(r => r.w);
  if (pre.length < 40) {
    for (const w of L.sortWines(stock, 'urgent', YEAR)) {
      if (pre.length >= 40) break;
      const st = L.status(w, YEAR);
      if (!pre.includes(w) && !(st && st.code === 'keep')) pre.push(w);
    }
  }
  if (!pre.length) { showLocal('Aucun vin prêt à boire.'); return; }
  const b = $('#go'); b.disabled = true; b.textContent = 'Recherche…';
  $('#blist').innerHTML = '<p class="empty">L’assistant choisit parmi vos vins…</p>';
  try {
    const picks = await AI.pickForDish(dish, pre);
    const out = picks.map(p => ({ w: S.wines.find(w => w.id === p.id), why: p.why })).filter(x => x.w);
    if (!out.length) showLocal('L’assistant n’a rien proposé. Suggestions sans IA :');
    else $('#blist').innerHTML = '<p class="mu small">Choix de l’assistant parmi vos vins prêts à boire.</p>' + out.map(x => card(x.w, 'boire', x.why)).join('');
  } catch (e) {
    errToast(AI.errText(e));
    showLocal('IA indisponible. Suggestions sans IA :');
  }
  b.disabled = false; b.textContent = 'Trouver le bon vin';
}

/* ============ Import tableur ============ */
async function importSheet(file) {
  const t = toast('Lecture du fichier…');
  let rows;
  try { rows = await IMP.readRows(file); }
  catch (e) { t.remove(); Stats.track('err_import'); errToast('Lecture du fichier impossible : ' + (e.message || 'format non reconnu') + '. Utilisez un fichier .xlsx ou .csv avec une ligne d’en-têtes.'); return; }
  t.remove();
  if (!rows.length) { errToast('Fichier vide ou sans ligne d’en-têtes.'); return; }
  let r = IMP.rowsToWines(rows, S.wines);
  let ignored = 0;
  if (!r.added.length && !r.updated.length) {
    Stats.track('err_import');
    errToast(`Aucun vin importé. Colonnes trouvées : ${Object.keys(rows[0]).join(', ') || 'aucune'}. Il faut au moins une colonne « Cuvée » ou « Domaine ».`);
    return;
  }
  if (r.existing > 0) {
    // des vins du fichier sont déjà en cave : on laisse choisir entre ignorer et additionner
    const n = r.added.length;
    const buttons = [];
    if (n > 0) buttons.push({ label: `Ajouter seulement les ${n} nouveau${n > 1 ? 'x' : ''}`, value: 'skip' });
    buttons.push({ label: 'Additionner les quantités', value: 'sum', kind: 'o' });
    buttons.push({ label: 'Annuler', value: null, kind: 'o' });
    const c = await ask('Vins déjà en cave',
      `${r.existing} ligne(s) du fichier correspondent à des vins déjà en cave, ${n} sont nouvelle(s). « Additionner » ajoute leur quantité à celle déjà en cave (à utiliser si ce sont de nouvelles bouteilles).`, buttons);
    if (!c) { toast('Import annulé : rien n’a été modifié.'); return; }
    if (c === 'skip') { r = IMP.rowsToWines(rows, S.wines, 'skip'); ignored = r.existing; }
  }
  const ok = await persist(() => store.putWines([...r.added, ...r.updated]));
  if (!ok) return;
  const byId = new Map(r.updated.map(w => [w.id, w]));
  S.wines = S.wines.map(w => byId.get(w.id) || w).concat(r.added);
  S.tab = 'cave'; S.filt = 'Tous'; S.sort = 'recent'; $('#sort').value = 'recent'; S.limit = PAGE;
  render();
  Stats.track('add_tableur', r.added.length); Stats.noteWines(S.wines.filter(w => !isDemo(w)).length);
  const chk = r.added.filter(w => w.check).length;
  toast(`✅ ${r.added.length} vin(s) ajouté(s)${r.merged ? ', ' + r.merged + ' doublon(s) additionné(s)' : ''}${ignored ? ', ' + ignored + ' déjà en cave (inchangé' + (ignored > 1 ? 's' : '') + ')' : ''}${r.skipped ? ', ' + r.skipped + ' ligne(s) ignorée(s)' : ''}${chk ? '. ' + chk + ' à vérifier (filtre « À vérifier »)' : ''}.`);
}

/* ============ Sauvegarde, restauration, export ============ */
const today = () => new Date().toISOString().slice(0, 10);
async function doBackup() {
  closeSheet('sMenu');
  if (!S.wines.length) { toast('Votre cave est vide : rien à sauvegarder.'); return; }
  let res;
  try { res = await saveFile(`ma-cave-${today()}.json`, L.makeBackup(S.wines), 'application/json'); }
  catch (e) { errToast('Sauvegarde impossible : ' + (e.message || 'erreur') + '. Essayez « Exporter en tableur ».'); return; }
  if (res === 'cancelled') { toast('Sauvegarde annulée.'); return; }
  S.lastBackup = Date.now();
  await persist(() => store.setMeta('lastBackup', S.lastBackup));
  render();
  toast(res === 'shared' ? '✅ Sauvegarde prête. Choisissez Drive pour la ranger.' : '✅ Sauvegarde téléchargée (dossier Téléchargements). Copiez-la dans votre Drive.');
}

async function doRestore(file) {
  let parsed;
  try { parsed = L.parseBackup(await readText(file)); }
  catch (e) { errToast(e.message || 'Fichier de sauvegarde invalide.'); return; }
  if (!parsed.wines.length) { errToast('Cette sauvegarde ne contient aucun vin.'); return; }
  const c = await ask('Restaurer la sauvegarde', `Le fichier contient ${parsed.wines.length} vin(s)${parsed.skipped ? ' (' + parsed.skipped + ' ligne(s) illisible(s) ignorée(s))' : ''}. Votre cave actuelle en contient ${S.wines.length}.`, [
    { label: 'Remplacer ma cave par la sauvegarde', value: 'replace', kind: S.wines.length ? 'danger' : '' },
    { label: 'Ajouter seulement les vins absents', value: 'merge', kind: 'o' },
    { label: 'Annuler', value: null, kind: 'o' }]);
  if (!c) return;
  if (c === 'replace') {
    const before = S.wines;
    if (!await persist(() => store.replaceAll(parsed.wines))) return;
    S.wines = parsed.wines; S.limit = PAGE; render(); Stats.noteOrigine('sauvegarde');
    toast(`✅ Cave restaurée : ${parsed.wines.length} vin(s).`, { action: before.length ? { label: 'Annuler', fn: async () => {
      if (await persist(() => store.replaceAll(before))) { S.wines = before; render(); toast('Restauration annulée.'); }
    } } : null });
  } else {
    const keys = new Set(S.wines.map(L.keyOf)); const ids = new Set(S.wines.map(w => w.id));
    const add = parsed.wines.filter(w => !keys.has(L.keyOf(w))).map(w => ids.has(w.id) ? { ...w, id: uid() } : w);
    if (!add.length) { toast('Tous les vins de la sauvegarde sont déjà dans votre cave.'); return; }
    if (!await persist(() => store.putWines(add))) return;
    S.wines = S.wines.concat(add); render(); Stats.noteOrigine('sauvegarde');
    toast(`✅ ${add.length} vin(s) ajouté(s) depuis la sauvegarde.`);
  }
}

async function exportCsv() {
  closeSheet('sMenu');
  if (!S.wines.length) { toast('Votre cave est vide.'); return; }
  try {
    const r = await saveFile(`ma-cave-${today()}.csv`, L.toCsv(L.sortWines(S.wines, 'name', YEAR)), 'text/csv');
    if (r !== 'cancelled') toast('✅ Tableur prêt (ouvrable dans Excel ou Google Sheets).');
  } catch (e) { errToast('Export impossible : ' + (e.message || 'erreur')); }
}

async function downloadTemplate() {
  const head = 'Domaine;Cuvée;Millésime;Couleur;Appellation;Cépage;Début garde;Fin garde;Quantité;Emplacement;Confiance';
  try { await saveFile('modele-cave.csv', '﻿' + head + '\r\n', 'text/csv'); } catch (e) { errToast('Téléchargement impossible.'); }
}

/* ============ Réglages ============ */
function fillAiFields(provider) {
  const p = AI.PROVIDERS[provider];
  const c = AI.getConfig(provider);
  $('#ai-help').textContent = p.help;
  $('#ai-key').value = c.key;
  $('#ai-model').value = c.model;
  $('#ai-model').placeholder = p.model || 'nom du modèle';
  $('#ai-base-w').hidden = provider !== 'openai';
  $('#ai-base').value = c.base;
}
// Liste des fournisseurs (✓ = clé enregistrée) et phrase expliquant le choix automatique.
function renderAiChoices(selected) {
  const on = AI.configuredKeys();
  $('#ai-prov').innerHTML = AI.ORDER.map(k => `<option value="${k}">${esc(AI.PROVIDERS[k].label)}${on.includes(k) ? ' ✓' : ''}</option>`).join('');
  $('#ai-prov').value = selected;
  $('#ai-auto').textContent = on.length > 1
    ? `L’appli choisit seule l’IA, dans cet ordre : ${on.map(k => AI.PROVIDERS[k].label.split(' ')[0]).join(' → ')}. Si l’une est épuisée ou en panne, elle passe à la suivante.`
    : on.length === 1 ? 'Une seule IA configurée. Ajoutez-en une autre (choisissez-la dans la liste) : l’appli passera seule de l’une à l’autre si crédits ou limites sont épuisés.'
    : 'Aucune IA configurée.';
}
async function openSettings() {
  closeSheet('sMenu');
  const s = AI.getSettings();
  renderAiChoices(s.provider);
  fillAiFields(s.provider);
  $('#ai-key').type = 'password'; $('#ai-show').textContent = 'Voir';
  majGuideCle();
  $('#st-ver').textContent = VERSION;
  $('#st-auto').checked = auto.on; $('#st-auto-info').textContent = autoStatus();
  $('#st-maj').onclick = () => { closeSheet('sSet'); enrichAll(); };
  const notifInfo = () => {
    if (!('Notification' in window)) return 'Non disponible sur ce navigateur.';
    if (Notification.permission === 'granted') return 'Activé. Sur Android, une notification apparaît quand une nouvelle version est publiée, même appli fermée (fréquence décidée par le navigateur).';
    if (Notification.permission === 'denied') return 'Refusé. Autorisez les notifications pour Ma cave dans les réglages du téléphone.';
    return 'Désactivé.';
  };
  $('#st-notif-info').textContent = notifInfo();
  $('#st-notif').hidden = !('Notification' in window) || Notification.permission === 'granted';
  $('#st-notif').onclick = async () => {
    try {
      const p = await Notification.requestPermission();
      $('#st-notif-info').textContent = notifInfo();
      $('#st-notif').hidden = p === 'granted';
      if (p !== 'granted') toast('Notifications non autorisées : rien ne sera affiché.');
    } catch (e) { errToast('Impossible de demander l’autorisation : ' + (e.message || 'erreur')); }
  };
  $('#st-stats-w').hidden = !Stats.configured();
  $('#st-stats').checked = Stats.consentState() === 'oui';
  $('#st-info').textContent = 'Lecture…';
  openSheet('sSet');
  const i = await store.info();
  const mb = v => v == null ? '?' : (v / 1048576).toFixed(1).replace('.', ',') + ' Mo';
  $('#st-info').textContent = `${S.wines.length} vin(s) enregistré(s) sur ce téléphone. ` +
    (i.persistent ? (i.protected ? 'Stockage protégé contre l’effacement automatique. ' : 'Stockage non protégé : le navigateur pourrait l’effacer s’il manque de place. Sauvegardez régulièrement. ') : 'Stockage indisponible (navigation privée ?). ') +
    (i.usage != null ? `Espace utilisé : ${mb(i.usage)}.` : '');
}
function readAiFields() {
  return { provider: $('#ai-prov').value, key: $('#ai-key').value, model: $('#ai-model').value || AI.PROVIDERS[$('#ai-prov').value].model, base: $('#ai-base').value };
}
function saveAi(silent) {
  const v = readAiFields();
  if (v.provider === 'openai' && v.key && !/^https:\/\//.test(v.base.trim())) { errToast(AI.ERR.bad_base); return false; }
  if (v.key && /\s/.test(v.model.trim())) { errToast('Nom de modèle invalide : il ne contient jamais d’espace (exemple : ' + (AI.PROVIDERS[v.provider].model || 'gpt-4o-mini') + ').'); return false; }
  try { AI.setSettings(v); } catch (e) { errToast('Enregistrement des réglages impossible (stockage du navigateur bloqué).'); return false; }
  renderAiChoices(v.provider);
  majGuideCle();
  if (!silent) toast(v.key ? '✅ Réglages IA enregistrés.' : 'Clé retirée pour ce fournisseur.');
  return true;
}
async function testAi() {
  if (!saveAi(true)) return;
  const prov = $('#ai-prov').value;
  if (!AI.configuredKeys().includes(prov)) { errToast('Saisissez d’abord une clé pour ce fournisseur.'); return; }
  const b = $('#ai-test'); b.disabled = true; b.textContent = 'Test en cours…';
  try { const ok = await AI.testKey({ only: prov }); ok ? toast('✅ Connexion à l’IA réussie.') : errToast('Réponse inattendue de l’IA. Vérifiez le modèle.'); }
  catch (e) { errToast(AI.errText(e)); }
  b.disabled = false; b.textContent = 'Tester la connexion';
}
async function eraseAll() {
  const c1 = await ask('Effacer toutes les données ?', `Les ${S.wines.length} vin(s) de ce téléphone seront supprimés. Faites d’abord une sauvegarde si vous voulez les garder.`, [
    { label: 'Continuer', value: 'go', kind: 'danger' }, { label: 'Annuler', value: null, kind: 'o' }]);
  if (c1 !== 'go') return;
  const c2 = await ask('Dernière confirmation', 'Cette action est définitive.', [
    { label: 'Tout effacer', value: 'go', kind: 'danger' }, { label: 'Annuler', value: null, kind: 'o' }]);
  if (c2 !== 'go') return;
  if (!await persist(() => store.replaceAll([]))) return;
  S.wines = []; closeSheet('sSet'); render(); toast('Toutes les données ont été effacées.');
}

/* ============ Mises à jour (service worker) ============ */
let swReg = null;
async function initSW() {
  if (!('serviceWorker' in navigator)) return;
  const hadController = !!navigator.serviceWorker.controller;
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || reloading) return;
    reloading = true; location.reload();
  });
  try {
    // updateViaCache 'none' : ignore le cache HTTP de l'hébergeur pour détecter les nouvelles versions
    swReg = await navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' });
    const watch = w => w && w.addEventListener('statechange', () => { if (w.state === 'installed' && navigator.serviceWorker.controller) { S.update = w; renderBanners(); } });
    if (swReg.waiting && navigator.serviceWorker.controller) { S.update = swReg.waiting; renderBanners(); }
    watch(swReg.installing);
    swReg.addEventListener('updatefound', () => watch(swReg.installing));
    document.addEventListener('visibilitychange', () => { if (!document.hidden) swReg.update().catch(() => {}); });
  } catch (e) { /* hors ligne ou non supporté : l'appli fonctionne quand même */ }
}
function applyUpdate() {
  if (!S.update) return;
  S.update.postMessage({ type: 'SKIP_WAITING' });
  toast('Mise à jour en cours…');
}
async function checkUpdate() {
  if (!swReg) { toast('Mises à jour indisponibles ici (appli non installée depuis son adresse web).'); return; }
  const b = $('#st-upd'); b.disabled = true; b.textContent = 'Vérification…';
  try {
    await swReg.update();
    await new Promise(r => setTimeout(r, 1500));
    if (S.update || swReg.waiting || swReg.installing) toast('Nouvelle version trouvée : touchez « Mettre à jour » en haut de l’écran.');
    else toast('Vous avez la dernière version (' + VERSION + ').');
  } catch (e) { errToast('Vérification impossible (pas de connexion ?).'); }
  b.disabled = false; b.textContent = 'Vérifier les mises à jour';
}

/* ============ Menu et événements ============ */
// Cave de démonstration : ajout et retrait. Seuls les vins « demo- » sont concernés ; les vôtres ne sont jamais touchés.
async function chargerDemo() {
  const ajout = demoWines(YEAR).map(x => L.normalizeWine(x)).filter(w => w && !S.wines.some(e => e.id === w.id));
  if (!ajout.length) return;
  const ok = await persist(() => store.putWines(ajout));
  if (!ok) return;   // persist() a déjà expliqué l’échec ; aucun message de réussite
  S.wines.push(...ajout);
  S.filt = 'Tous'; S.statut = ''; S.q = ''; if ($('#q')) $('#q').value = '';
  render();
  toast('Cave de démonstration chargée : 15 bouteilles fictives. Explorez les onglets, puis touchez « Effacer la démo ».');
}
async function effacerDemo() {
  const ids = S.wines.filter(isDemo).map(w => w.id);
  if (!ids.length) return;
  const c = await ask('Effacer la cave de démonstration ?', `Les ${ids.length} vins fictifs seront retirés. Vos propres vins ne sont pas touchés.`, [
    { label: 'Effacer la démo', value: 'yes', kind: 'danger' }, { label: 'Garder', value: null, kind: 'o' }]);
  if (c !== 'yes') return;
  if (!(await persist(() => store.deleteWines(ids)))) return;
  S.wines = S.wines.filter(w => !isDemo(w));
  render();
  toast('Cave de démonstration effacée.');
}

function menuAction(m) {
  const pick = id => { closeSheet('sMenu'); $(id).click(); };
  // Si l'IA n'est pas disponible (limite du jour, pas de clé), le menu se ferme : sinon la fenêtre d'explication attendrait derrière lui.
  // Photo gratuite du jour utilisée : l'encart du menu explique et propose deux actions, sans fenêtre bloquante.
  if ((m === 'cam' || m === 'img') && AI.etatPhoto() === 'limite') { renderMenuEnc(); const el = $('#m-enc'); el.tabIndex = -1; el.focus(); toast('Photo gratuite du jour utilisée : activez votre clé gratuite, ou saisissez ce vin à la main.'); return; }
  if (m === 'cam') { if (requireAI()) pick('#fCam'); else closeSheet('sMenu'); }
  else if (m === 'img') { if (requireAI()) pick('#fImg'); else closeSheet('sMenu'); }
  else if (m === 'xls') pick('#fXls');
  else if (m === 'man') openForm(null);
  else if (m === 'demo') chargerDemo();
  else if (m === 'democlear') effacerDemo();
  else if (m === 'enr') { closeSheet('sMenu'); enrichAll(); }
  else if (m === 'bk') doBackup();
  else if (m === 'res') pick('#fJson');
  else if (m === 'csv') exportCsv();
  else if (m === 'help') { closeSheet('sMenu'); openSheet('sHelp'); }
}

function bind() {
  $('#fab').onclick = () => { renderMenuEnc(); openSheet('sMenu'); };
  $('#bSet').onclick = openSettings;
  $('#bTitle').onclick = openTitle;
  $('#bContact').onclick = openContact;
  $('#bReport').onclick = () => { openContact(); $('#ct-type').value = 'Bug (quelque chose ne marche pas)'; };
  $('#st-stats').onchange = async () => { await Stats.setConsent($('#st-stats').checked); toast($('#st-stats').checked ? 'Statistiques anonymes activées.' : 'Statistiques arrêtées : rien ne sera envoyé.'); };
  $('#st-stats-show').onclick = showStatsPreview;
  $('#st-auto').onchange = () => { auto.on = $('#st-auto').checked; if (auto.on) auto.pauseUntil = 0; autoSave(); $('#st-auto-info').textContent = autoStatus(); if (auto.on) setTimeout(autoStep, 500); };
  $('#st-help').onclick = openContact;
  $('#st-esprit').onclick = () => openSheet('sEsprit');
  $$('#sAct [data-x]').forEach(b => { b.onclick = () => runAction(b.dataset.x); });
  $('#st-news').onclick = () => { const l = Notes.since('0.0.0', VERSION); ask('Nouveautés', l.length ? l.map(x => '• ' + x).join('\n') : 'Aucune nouveauté à afficher.', [{ label: 'Fermer', value: 'ok' }]); };
  $('#ct-share').onclick = sendContact;
  $('#ct-pub').onclick = publishContact;
  $('#ct-copy').onclick = async () => {
    if (!$('#ct-msg').value.trim()) { errToast('Écrivez d’abord votre message.'); return; }
    toast(await copyText(contactText()) ? 'Message copié.' : 'Copie impossible : sélectionnez le texte à la main.', {});
  };
  $('#appTitle').onclick = openTitle;
  $('#ti-save').onclick = () => saveTitle($('#ti-in').value);
  $('#ti-reset').onclick = () => saveTitle('');
  $('#ti-in').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); saveTitle($('#ti-in').value); } });
  $('#sMenu').addEventListener('click', e => { const b = e.target.closest('[data-m]'); if (b) menuAction(b.dataset.m); });
  $$('[data-close]').forEach(b => { b.onclick = () => closeSheet(b.dataset.close); });
  initSheetGestures();
  $$('.modal').forEach(m => m.addEventListener('click', e => {
    if (e.target !== m) return;
    if (m.id === 'sLog' && logRunning) return;
    if (m.id === 'sDlg' && dlgForce) return;
    if (m.id === 'sForm') return; // évite de perdre une saisie par un toucher à côté
    closeSheet(m.id);
  }));
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape' || !stack.length) return;
    const id = stack[stack.length - 1];
    if (id === 'sLog' && logRunning) return;
    closeSheet(id);
  });

  $$('.tab').forEach(b => { b.onclick = () => { S.tab = b.dataset.t; if (S.tab === 'boire') Stats.track('quoiboire'); render(); }; });
  $('#sVbtn').onclick = () => { let cache = valeurCachee(); try { localStorage.setItem('cave-cacher-valeur', cache ? '0' : '1'); } catch (e) { /* stockage bloqué : le geste n'est pas gardé */ } renderStats(); };
  $('#chips').onclick = e => {
    if (e.target.closest('[data-stat]')) { S.statut = null; S.limit = PAGE; renderList(); return; }
    const b = e.target.closest('[data-c]'); if (b) { S.filt = b.dataset.c; S.statut = null; S.limit = PAGE; renderList(); }
  };
  // Magic : toucher une case ouvre la liste des vins concernés.
  $('#vChiffres').onclick = e => {
    const a = e.target.closest('[data-act]');
    if (a && a.dataset.act === 'valeur') { valeurCaveIA(); return; }
    const b = e.target.closest('[data-goto]'); if (!b) return;
    S.statut = b.dataset.goto; S.tab = 'cave'; S.filt = 'Tous'; S.q = ''; $('#q').value = ''; S.limit = PAGE;
    render(); window.scrollTo(0, 0);
  };
  $('#bchips').onclick = e => { const b = e.target.closest('[data-b]'); if (b) { S.bmode = b.dataset.b; $('#blist').innerHTML = ''; renderBoire(); } };
  let qt;
  $('#q').addEventListener('input', () => { clearTimeout(qt); qt = setTimeout(() => { S.q = $('#q').value; S.limit = PAGE; renderList(); }, 150); });
  $('#sort').onchange = () => { S.sort = $('#sort').value; S.limit = PAGE; renderList(); };
  $('#list').addEventListener('click', onCardAction);
  $('#blist').addEventListener('click', onCardAction);
  $('#updBar').addEventListener('click', e => { const b = e.target.closest('[data-b="upd"]'); if (b) applyUpdate(); });
  $('#banners').addEventListener('click', e => { const b = e.target.closest('[data-b]'); if (!b) return; if (b.dataset.b === 'bk') doBackup(); else if (b.dataset.b === 'upd') applyUpdate(); });
  $('#go').onclick = findForDish;

  F('save').onclick = saveForm;
  F('cancel').onclick = () => closeSheet('sForm');
  F('gen').onclick = genInForm;
  F('story').addEventListener('input', majRelecture);
  F('rl-ok').onclick = () => { S.formExtra.relu = true; majRelecture(); };
  F('web').onclick = webHistoire;

  const onFiles = (id, fn) => { $(id).addEventListener('change', e => { const fl = [...e.target.files]; e.target.value = ''; if (fl.length) fn(fl); }); };
  onFiles('#fCam', scanFiles); onFiles('#fImg', scanFiles);
  onFiles('#fXls', fl => importSheet(fl[0])); onFiles('#fJson', fl => doRestore(fl[0]));

  $('#lgStop').onclick = null;
  $('#lgX').onclick = () => closeSheet('sLog');
  $('#lgMan').onclick = () => { const p = photoEchec; hideSheet('sLog'); openForm(null); if (p) montrerPhotoForm(p); };
  initCle();

  $('#ai-prov').onchange = () => fillAiFields($('#ai-prov').value);
  AI.hooks.onSwitch = (from, to, e) => toast(`${AI.PROVIDERS[from].label.split(' ')[0]} indisponible (${AI.errText(e).replace(/\.$/, '').slice(0, 60)}) : ${AI.PROVIDERS[to].label.split(' ')[0]} prend le relais.`);
  $('#ai-show').onclick = () => { const k = $('#ai-key'); const show = k.type === 'password'; k.type = show ? 'text' : 'password'; $('#ai-show').textContent = show ? 'Masquer' : 'Voir'; };
  $('#ai-open').onclick = () => { try { window.open('https://aistudio.google.com/app/apikey', '_blank', 'noopener,noreferrer'); } catch (e) { errToast('Ouvrez aistudio.google.com dans votre navigateur.'); } };
  $('#ai-copy').onclick = async () => { try { await navigator.clipboard.writeText('https://aistudio.google.com/app/apikey'); toast('Adresse copiée. Collez-la dans votre navigateur.'); } catch (e) { errToast('Copie impossible : sélectionnez l’adresse dans le texte et copiez-la.'); } };
  $('#ai-paste').onclick = async () => {
    try {
      const t = ((await navigator.clipboard.readText()) || '').trim();
      if (!t) { errToast('Le presse-papiers est vide : copiez d’abord la clé dans Google AI Studio.'); return; }
      $('#ai-key').value = t; toast('Clé collée. Touchez « Enregistrer » puis « Tester la connexion ».');
    } catch (e) { errToast('Collage impossible : touchez le champ « Clé API », maintenez le doigt et choisissez « Coller ».'); }
  };
  $('#ai-save').onclick = () => { if (saveAi()) closeSheet('sSet'); };
  $('#ai-test').onclick = testAi;
  $('#st-erase').onclick = eraseAll;
  $('#st-upd').onclick = checkUpdate;

  $('#h-tpl').onclick = downloadTemplate;
  $('#tg-stars').onclick = e => { const b = e.target.closest('[data-n]'); if (!b) return; tgNote = Number(b.dataset.n); paintStars(); };
  $('#tg-save').onclick = saveTasting;
  $('#tg-cancel').onclick = () => { tgWine = null; closeSheet('sTasting'); };
  $('#sHelp').addEventListener('click', e => {
    const b = e.target.closest('[data-copy]'); if (!b) return;
    const el = $('#' + b.dataset.copy); const label = b.textContent;
    const done = ok => { b.textContent = ok ? 'Copié ✓' : 'Texte sélectionné : copiez-le'; setTimeout(() => { b.textContent = label; }, 2500); };
    const select = () => { const r = document.createRange(); r.selectNodeContents(el); const s = getSelection(); s.removeAllRanges(); s.addRange(r); done(false); };
    try { navigator.clipboard.writeText(el.textContent).then(() => done(true), select); } catch (err) { select(); }
  });
}

/* ============ Titre modifiable et citation du jour ============ */
function renderTitle() {
  $('#appTitle').textContent = S.title;
  document.title = S.title;
}
/* ============ Aide et contact ============ */
function contactText() {
  const t = $('#ct-type').value.split(' (')[0];
  const nav = String(navigator.userAgent || '').slice(0, 200);
  return `[${t}] ${$('#ct-msg').value.trim()}\n\n---\nAppli « Ma cave » version ${VERSION}\nAppareil : ${nav}`;
}
async function copyText(t) {
  try { await navigator.clipboard.writeText(t); return true; } catch (e) { return false; }
}
function openContact() {
  Stats.track('aide');
  closeSheet('sSet');
  $('#ct-msg').value = '';
  openSheet('sContact');
}
async function sendContact() {
  if (!$('#ct-msg').value.trim()) { errToast('Écrivez d’abord votre message.'); $('#ct-msg').focus(); return; }
  const text = contactText();
  if (navigator.share) {
    try { await navigator.share({ title: 'Retour sur Ma cave', text }); toast('Choisissez l’application et le destinataire : rien n’est parti tant que vous n’avez pas validé l’envoi.'); }
    catch (e) { if (!(e && e.name === 'AbortError')) errToast('Le partage a échoué. Touchez « Copier le message » puis envoyez-le vous-même.'); }
    return;
  }
  toast(await copyText(text) ? 'Partage indisponible ici : le message est copié, collez-le dans votre messagerie.' : 'Partage et copie impossibles. Sélectionnez le texte du message et copiez-le à la main.', { kind: 'err' });
}
// Publie le message dans le formulaire Google, sans quitter l’appli. La réponse du service est opaque (pas de lecture possible) :
// seule une absence de réseau est détectable, c’est pourquoi on la refuse explicitement.
async function publishContact() {
  if (!$('#ct-msg').value.trim()) { errToast('Écrivez d’abord votre message.'); $('#ct-msg').focus(); return; }
  if (!FEEDBACK_ENTRY) { errToast('L’envoi direct n’est pas encore configuré. Utilisez « Envoyer par message ».'); return; }
  if (navigator.onLine === false) { errToast('Pas de connexion : votre message n’est pas parti. Il reste ici, réessayez avec du réseau.'); return; }
  const b = $('#ct-pub'); b.disabled = true; b.textContent = 'Envoi en cours…';
  try {
    const ok = await Stats.posterFormulaire(FEEDBACK_POST, FEEDBACK_ENTRY, contactText());
    if (!ok) throw new Error('envoi non confirmé');
    toast('✅ Requête publiée. Merci !');
    $('#ct-msg').value = ''; closeSheet('sContact');
  } catch (e) {
    errToast('Envoi impossible (réseau coupé ou bloqué). Votre message est conservé : réessayez, ou utilisez « Envoyer par message ».');
  }
  b.disabled = false; b.textContent = 'Publier ma requête';
}

function openTitle() {
  $('#ti-in').value = S.title === DEFAULT_TITLE ? '' : S.title;
  openSheet('sTitle');
  setTimeout(() => { try { $('#ti-in').focus(); } catch (e) { /* */ } }, 50);
}
async function saveTitle(value) {
  const t = String(value || '').replace(/\s+/g, ' ').trim().slice(0, 40) || DEFAULT_TITLE;
  const before = S.title;
  S.title = t; renderTitle();
  if (!await persist(() => store.setMeta('title', t))) { S.title = before; renderTitle(); return; }
  closeSheet('sTitle');
  toast('✅ Titre enregistré : « ' + t + ' ».');
}

// Une citation au hasard à chaque ouverture, jamais la même que la fois précédente.
function showQuote() {
  let last = -1;
  try { last = Number(localStorage.getItem('cave-lastq')); } catch (e) { /* stockage bloqué : pas grave */ }
  let i = Math.floor(Math.random() * QUOTES.length);
  if (QUOTES.length > 1 && i === last) i = (i + 1 + Math.floor(Math.random() * (QUOTES.length - 1))) % QUOTES.length;
  try { localStorage.setItem('cave-lastq', String(i)); } catch (e) { /* */ }
  $('#quoteText').textContent = QUOTES[i];
}

/* ============ Nouveautés après mise à jour ============ */
// Les fenêtres d'accueil (nouveautés, statistiques) passent l'une après l'autre, jamais par-dessus une autre fenêtre ouverte.
const whenFree = async () => { await new Promise(r => setTimeout(r, 450)); while (document.querySelector('.modal.show')) await new Promise(r => setTimeout(r, 500)); };
/* ============ Première ouverture : message de bienvenue ============ */
// Une fois : à la première ouverture après installation, et à la première ouverture après la mise à jour qui l'introduit (cave existante comprise).
async function showBienvenue() {
  try {
    // Les tests automatisés ne voient pas ce message, sauf s'ils le demandent.
    if (navigator.webdriver && !window.__BIENVENUE) return;
    const deja = await store.getMeta('bienvenue');
    if (deja) return;
    await store.setMeta('bienvenue', { prenom: '', date: Date.now() });
    await whenFree();
    const step1 = $('#bvStep1'), step2 = $('#bvStep2');
    step1.hidden = false; step2.hidden = true; $('#bvPrenom').value = '';
    const montrerMessage = prenom => {
      const nom = prenom ? ', ' + prenom : '';
      $('#bvMsg').innerHTML = `<p><b>Merci d’avoir téléchargé l’application${esc(nom)} !</b></p>
        <p>Tout d’abord, ouvrez une bouteille avant de faire le tour de l’application.</p>
        <p>Vos retours, positifs ou d’amélioration, seront les bienvenus !</p>
        <p>Merci,<br>Jeff</p>`;
      step1.hidden = true; step2.hidden = false;
    };
    $('#bvOk').onclick = async () => {
      const prenom = $('#bvPrenom').value.trim().slice(0, 30);
      try { await store.setMeta('bienvenue', { prenom, date: Date.now() }); prenomMem = prenom; } catch (e) { /* le prénom n'est pas enregistré : le message reste affiché */ }
      montrerMessage(prenom);
    };
    $('#bvPasse').onclick = () => { closeSheet('sBienv'); };
    openSheet('sBienv');
  } catch (e) { console.error('bienvenue', e); }
}

async function showNews() {
  try {
    const seen = await store.getMeta('seenVersion');
    if (VERSION === '?' || seen === VERSION) return;
    await store.setMeta('seenVersion', VERSION);
    if (!seen) return; // première installation : rien à résumer
    const lines = Notes.since(seen, VERSION);
    if (!lines.length) return;
    await whenFree();
    await ask(`Mise à jour ${VERSION} installée`, 'Ce qui change :\n\n' + lines.map(l => '• ' + l).join('\n'), [{ label: 'Compris', value: 'ok' }]);
  } catch (e) { console.error('nouveautés', e); }
}

/* ============ Fiches complétées automatiquement (en arrière-plan) ============ */
// Économe : 1 appel = 10 vins, 4 appels par jour au plus, jamais pendant une saisie, pause jusqu'à la remise à zéro des quotas
// (minuit heure du Pacifique ≈ 9 h UTC) dès que l'IA signale une limite. Le tout sans message : l'état se lit dans Réglages.
const AUTO_MAX_CALLS = 20, AUTO_TRIES = 2, AUTO_LOT = 10, AUTO_LOT_WEB = 5;
let autoPrio = null;
const AUTO_DELAY = self.__AUTO_DELAY ?? 20000, AUTO_EVERY = self.__AUTO_EVERY ?? 180000;
let auto = { on: true, day: '', calls: 0, pauseUntil: 0, pauseWhy: '', tries: {} };
let autoBusy = false;
// Appellation non reconnue, sans ligne de la bible ni rang : la garde est cherchée sur le web (si une clé Gemini est saisie et si la recherche web n'est pas en pause), jamais pour une garde saisie par l'utilisateur.
const gardeInconnue = w => !!(w.aiPass && w.year && w.name && !(w.src && (w.src.from === 'user' || w.src.to === 'user' || w.src.from === 'bible' || w.src.from === 'calc')) && !L.bibleEntry(w, S.bible) && apogee(w, YEAR).connue === false);
// À faire : les vins jamais passés (IA sans recherche, avec leur valeur), puis ceux à compléter (recherche web si elle n'est pas en pause, valeur seule).
const aChercherWeb = w => AI.RECHERCHE_WEB && !w.aiSearch && (L.doutesEffectifs(w).length || gardeInconnue(w));
const autoTodo = () => S.wines.filter(w => w.qty > 0 && (auto.tries[w.id] || 0) < AUTO_TRIES && (!w.aiPass || aChercherWeb(w) || !w.estim))
  .sort((a, b) => (!a.aiPass ? 0 : 1) - (!b.aiPass ? 0 : 1) || (b.qty > 0) - (a.qty > 0));
function nextQuotaReset(now = Date.now()) {
  const d = new Date(now); d.setUTCHours(9, 0, 0, 0);
  if (d.getTime() <= now) d.setUTCDate(d.getUTCDate() + 1);
  return d.getTime();
}
const autoSave = () => store.setMeta('autoFill', auto).catch(() => {});
// Tâche de fond : Chrome Android lance la passe deux fois par jour, appli fermée. Ailleurs (iPhone), la passe se fait à l'ouverture.
async function initFond() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.addEventListener('message', async e => {
    if (e.data && e.data.type === 'PASSE_IA_FIN') {
      try { S.wines = await store.allWines(); render(); } catch (err) { /* l'affichage se rafraîchira à la prochaine ouverture */ }
    }
  });
  try {
    const reg = await navigator.serviceWorker.ready;
    if (reg.periodicSync) await reg.periodicSync.register('passe-ia', { minInterval: 12 * 3600e3 });
  } catch (e) { /* refusé ou non disponible : la passe reste à l'ouverture de l'appli */ }
}
const iPhone = () => /iPhone|iPad|iPod/.test(navigator.userAgent);
async function initAuto() {
  initFond();
  // La bible d'abord, sur toute la cave : aucun jeton.
  const bibleMaj = [];
  for (const w of S.wines) { const c = JSON.parse(JSON.stringify(w)); const a = L.prefillFromBible(c, S.bible, fenetreRang); const b = L.prefillReperes(c, repereVin, accordsRepere); if (a || b) bibleMaj.push(c); }
  if (bibleMaj.length) { if (await persist(() => store.putWines(bibleMaj))) bibleMaj.forEach(c => remplace(S.wines.find(x => x.id === c.id), c)); render(); }
  try { const m = await store.getMeta('autoFill'); if (m && typeof m === 'object') auto = { ...auto, ...m, tries: { ...(m.tries || {}) } }; } catch (e) { /* valeurs par défaut */ }
  // Sur iPhone, pas de tâche de fond : un rappel discret, au plus une fois par jour, s’il reste beaucoup de fiches à vérifier.
  const jour = new Date().toISOString().slice(0, 10);
  if (iPhone() && AI.geminiPerso() && auto.on && autoTodo().length >= 20 && auto.remindDay !== jour) {
    auto.remindDay = jour; autoSave();
    toast('Sur iPhone, ouvrez l’appli pour mettre les fiches à jour.');
  }
  setTimeout(autoStep, AUTO_DELAY);
  setInterval(autoStep, AUTO_EVERY);
}
function autoStatus() {
  const base = autoStatusBase();
  const quand = auto.lastOk ? ` Dernière mise à jour : ${new Date(auto.lastOk).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}.` : '';
  return base + quand + (iPhone() && auto.on && AI.geminiPerso() ? ' Sur iPhone, ouvrez l’appli pour mettre les fiches à jour.' : '');
}
function autoStatusBase() {
  if (!AI.ready()) return 'Inactif : aucune IA configurée.';
  if (!AI.geminiPerso()) return 'Inactif : ajoutez votre propre clé Gemini gratuite dans ⚙ Réglages.';
  if (!auto.on) return 'Désactivé.';
  const n = autoTodo().length;
  if (!n) return 'Toutes vos fiches sont complètes.';
  if (auto.pauseUntil > Date.now()) return `${n} fiche(s) à vérifier. En pause (${auto.pauseWhy || 'limite de l’IA'}), reprise ${new Date(auto.pauseUntil).toDateString() === new Date().toDateString() ? 'vers ' + new Date(auto.pauseUntil).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : 'demain'}.`;
  return `${n} fiche(s) à vérifier, traitées petit à petit en arrière-plan.`;
}
async function autoStep() {
  if (autoBusy || !auto.on || !S.ready || !AI.ready() || document.hidden || navigator.onLine === false) return;
  if (document.querySelector('.modal.show') || /^(INPUT|TEXTAREA|SELECT)$/.test((document.activeElement || {}).tagName)) return;
  const now = Date.now(), day = new Date(now).toISOString().slice(0, 10);
  if (auto.day !== day) { auto.day = day; auto.calls = 0; }
  // Les quotas et le verrou sont partagés avec la passe de fond (service worker) : on relit ce qu'elle a fait.
  try {
    const frais = await store.getMeta('autoFill');
    if (frais && typeof frais === 'object') {
      if (frais.day === day) auto.calls = Math.max(auto.calls, frais.calls || 0);
      auto.pauseUntil = Math.max(auto.pauseUntil, frais.pauseUntil || 0);
    }
    const verrou = await store.getMeta('passeVerrou');
    if (verrou && Date.now() - verrou < 5 * 6e4 * 1) return;
  } catch (e) { /* lecture impossible : on attend le prochain tour */ return; }
  if (now < auto.pauseUntil || auto.calls >= AUTO_MAX_CALLS) return;
  // Recherche web automatique : Gemini seulement (les autres fournisseurs n'ont pas de recherche web ici).
  if (!AI.geminiPerso()) return;
  const todo = autoTodo();
  const premier = todo.find(x => x.id === autoPrio) || todo[0];
  autoPrio = null;
  if (!premier) return gardeStep(now);
  // Un lot de même nature : fiche sans recherche (10 vins, avec la valeur), recherche web (5 vins) ou valeur seule (10 vins).
  const genre = w => (!w.aiPass ? 'fiche' : aChercherWeb(w) ? 'web' : 'valeur');
  const g = genre(premier);
  const lot = [premier, ...todo.filter(x => x.id !== premier.id && genre(x) === g)].slice(0, g === 'web' ? AUTO_LOT_WEB : AUTO_LOT);
  autoBusy = true; auto.calls++;
  store.setMeta('passeVerrou', Date.now()).catch(() => {});
  try {
    const opts = { noRetry: true, only: 'gemini', noRelais: true };
    const res = g === 'fiche' ? await AI.makeFiches(lot, opts) : g === 'web' ? await AI.makeFichesWeb(lot, opts) : await AI.estimeValeur(lot, opts);
    const changed = [];
    for (const w of lot) {
      const d = res.get(String(w.id));
      if (!d) { auto.tries[w.id] = (auto.tries[w.id] || 0) + 1; continue; }
      if (g === 'valeur') { const cp = JSON.parse(JSON.stringify(w)); cp.estim = d; changed.push([w, cp]); }
      else changed.push([w, copieIA(w, d)]);
    }
    if (changed.length) {
      Stats.track('fiches_ia', changed.length);
      if (await persist(() => store.putWines(changed.map(x => x[1])))) {
        changed.forEach(([w, c]) => remplace(w, c));
        auto.lastOk = Date.now();
        if (g !== 'valeur') changed.forEach(([, c]) => S.ouvert.add(c.id));
        render();
        if (g !== 'valeur') toast('✨ ' + changed.length + (changed.length > 1 ? ' fiches mises à jour' : ' fiche mise à jour') + ' par l’assistant');
      } else changed.forEach(([w]) => { auto.tries[w.id] = (auto.tries[w.id] || 0) + 1; });
    }
    auto.pauseUntil = 0;
  } catch (e) {
    const code = e && e.code;
    if (code === 'rate_limited' || code === 'limite_gratuite') { auto.pauseUntil = nextQuotaReset(); auto.pauseWhy = 'limite de l’IA atteinte'; }
    else if (code === 'service_gratuit') { auto.pauseUntil = now + 30 * 6e4; auto.pauseWhy = 'service gratuit indisponible'; }
    else if (['bad_key', 'bad_model', 'bad_base', 'no_key'].includes(code)) {
      auto.pauseUntil = now + 864e5; auto.pauseWhy = 'clé ou modèle d’IA à vérifier';
      errToastReglages('Fiches automatiques en pause : ' + AI.errText(e));
    } else { auto.pauseUntil = now + 30 * 6e4; auto.pauseWhy = 'connexion ou serveur indisponible'; }
  } finally { autoBusy = false; autoSave(); store.setMeta('passeVerrou', 0).catch(() => {}); }
}

// Vins déjà traités dont la fenêtre de garde (bible, calcul, ancienne réponse de l'IA) n'a pas encore été contrôlée par l'IA : un lot de 10 par passage,
// seulement quand il n'y a plus de fiche à compléter. Une garde saisie à la main n'est jamais contrôlée.
const gardeTodo = () => S.wines.filter(w => w.qty > 0 && w.aiPass && w.from && w.to && !(w.src && (w.src.from === 'user' || w.src.to === 'user')) && !L.gardeConfirmee(w) && (auto.tries['g' + w.id] || 0) < AUTO_TRIES);
async function gardeStep(now) {
  const lot = gardeTodo().slice(0, AUTO_LOT);
  if (!lot.length) return;
  autoBusy = true; auto.calls++;
  store.setMeta('passeVerrou', Date.now()).catch(() => {});
  try {
    const res = await AI.verifGarde(lot, { noRetry: true, only: 'gemini', noRelais: true });
    const changed = [];
    for (const w of lot) {
      const d = res.get(String(w.id)), cp = JSON.parse(JSON.stringify(w));
      if (d && L.verifierGarde(cp, d.from, d.to)) changed.push([w, cp]); else auto.tries['g' + w.id] = (auto.tries['g' + w.id] || 0) + 1;
    }
    if (changed.length) {
      if (await persist(() => store.putWines(changed.map(x => x[1])))) { changed.forEach(([w, c]) => remplace(w, c)); render(); }
      else changed.forEach(([w]) => { auto.tries['g' + w.id] = (auto.tries['g' + w.id] || 0) + 1; });
    }
    auto.pauseUntil = 0;
  } catch (e) {
    const code = e && e.code;
    if (code === 'rate_limited' || code === 'limite_gratuite') { auto.pauseUntil = nextQuotaReset(); auto.pauseWhy = 'limite de l’IA atteinte'; }
    else if (code === 'service_gratuit') { auto.pauseUntil = now + 30 * 6e4; auto.pauseWhy = 'service gratuit indisponible'; }
    else if (['bad_key', 'bad_model', 'bad_base', 'no_key'].includes(code)) { auto.pauseUntil = now + 864e5; auto.pauseWhy = 'clé ou modèle d’IA à vérifier'; errToastReglages('Fiches automatiques en pause : ' + AI.errText(e)); }
    else { auto.pauseUntil = now + 30 * 6e4; auto.pauseWhy = 'connexion ou serveur indisponible'; }
  } finally { autoBusy = false; autoSave(); store.setMeta('passeVerrou', 0).catch(() => {}); }
}

/* ============ Statistiques anonymes (facultatives) ============ */
const statsExtra = () => ({
  wines: S.wines.length,
  iaKeys: AI.configuredKeys().length,
  daysSinceBackup: S.lastBackup ? Math.floor((Date.now() - S.lastBackup) / 864e5) : -1,
});
async function initStats() {
  Stats.cfg.post = STATS_POST; Stats.cfg.entry = STATS_ENTRY; Stats.cfg.version = VERSION; Stats.cfg.relais = STATS_RELAIS;
  AI.hooks.onStat = k => Stats.track(k);
  try {
    await Stats.init(S.wines.length);
    if (Stats.configured() && Stats.consentState() === null) await askStatsConsent();
    Stats.track('ouvertures');
    if (!store.persistent) Stats.track('err_stockage');
    await Stats.flush(statsExtra());
    await askJourConsent();
    await Stats.sendDays(statsExtra());
  } catch (e) { console.error('stats', e); }
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) Stats.flush(statsExtra()).catch(() => {});
    else Stats.sendDays(statsExtra()).catch(() => {});   // en quittant l'appli : les gestes du jour partent
  });
}
async function askStatsConsent() {
  await whenFree();
  const c = await ask('Aider à améliorer l’appli ?',
    'Chaque jour, l’appli peut envoyer à son auteur un petit récapitulatif anonyme : si vous l’avez ouverte, quelles fonctions vous utilisez, et les erreurs rencontrées. Rien que des nombres : jamais le nom de vos vins, jamais vos photos ni vos clés, et votre adresse n’est pas enregistrée. Vous pouvez changer d’avis dans ⚙ Réglages et voir exactement ce qui est envoyé.',
    [{ label: 'Oui, aider', value: 'oui' }, { label: 'Non merci', value: 'non', kind: 'o' }]);
  if (c !== 'oui' && c !== 'non') return; // fenêtre remplacée par une autre : on redemandera à la prochaine ouverture
  await Stats.setConsent(c === 'oui');
  toast(c === 'oui' ? 'Merci ! Vous pouvez arrêter à tout moment dans ⚙ Réglages.' : 'Rien ne sera envoyé.');
}
// Les appareils qui avaient accepté l'envoi hebdomadaire sont interrogés une fois : le récapitulatif quotidien va vers un autre serveur (celui de l'auteur).
async function askJourConsent() {
  if (Stats.consentState() !== 'oui' || Stats.jourState() !== null || !Stats.relaisConfigured()) return;
  if (navigator.webdriver && !window.__JOUR) return; // les tests automatisés ne voient pas cette fenêtre, sauf s'ils la demandent
  await whenFree();
  const c = await ask('Un récapitulatif chaque jour ?',
    'Vous aidez déjà l’appli avec des statistiques anonymes envoyées une fois par semaine. Pour mieux repérer les erreurs, l’auteur propose un envoi par jour, vers son propre serveur : toujours des nombres seulement, aucun nom de vin, aucune photo, aucune clé, et votre adresse n’est pas enregistrée. Vous pouvez voir exactement ce qui part dans ⚙ Réglages.',
    [{ label: 'Oui, chaque jour', value: 'oui' }, { label: 'Non, rester hebdomadaire', value: 'non', kind: 'o' }]);
  if (c !== 'oui' && c !== 'non') return;
  await Stats.setJour(c === 'oui');
  toast(c === 'oui' ? 'Merci ! Envoi quotidien activé.' : 'D’accord, l’envoi reste hebdomadaire.');
  if (c === 'oui') Stats.sendDays(statsExtra()).catch(() => {});
}
// « Appréciez-vous l'application ? » : une fois, réponse obligatoire, envoyée anonymement (la fenêtre le dit). Réponse gardée et renvoyée plus tard si le réseau manquait.
async function askAvis() {
  try {
    if (navigator.webdriver && !window.__AVIS) return; // les tests automatisés ne voient pas cette fenêtre, sauf s'ils la demandent
    if (!Stats.configured()) return;
    const e = await Stats.avisEtat();
    if (e && e.rep) { if (!(e.sent && e.via === 'form')) await Stats.avisEnvoyer(); return; }
    // Comptage des ouvertures : un nouvel utilisateur reçoit la question à sa 2e ouverture ; celui qui avait déjà l'appli
    // (installée avant cette version) la reçoit tout de suite, à la mise à jour.
    let n = await store.getMeta('ouverturesAvis');
    if (!(n > 0)) {
      const installAt = await store.getMeta('installAt');
      n = installAt && Date.now() - installAt > 6e4 ? 2 : 1;
    } else n++;
    await store.setMeta('ouverturesAvis', n);
    if (n < 2) return;
    await whenFree();
    const c = await ask('Appréciez-vous l’application ?',
      'Votre réponse est envoyée anonymement à son auteur : un simple « oui » ou « non », rien d’autre (ni vos vins, ni votre nom).',
      [{ label: 'Oui', value: 'oui' }, { label: 'Non', value: 'non', kind: 'o' }], { force: true });
    if (c !== 'oui' && c !== 'non') return;
    await Stats.avisRepondre(c);
    toast('Merci pour votre réponse !');
  } catch (e) { console.error('avis', e); }
}
async function showStatsPreview() {
  const t = await Stats.preview(statsExtra());
  const j = await Stats.previewJour(statsExtra());
  const etat = await Stats.jourEtat();
  let txt = 'Rien : les statistiques sont désactivées.';
  if (t) {
    txt = `Chaque semaine (elle part la semaine suivante) : uniquement des nombres : 1) version 2) identifiant aléatoire de cette installation 3) semaines 4) compteurs d’usage.\n\n${t}`;
    if (j) {
      const dernier = etat && etat.ts ? (etat.ok ? `Dernier envoi réussi : ${new Date(etat.ts).toLocaleString('fr-FR')}.` : `Dernier essai du ${new Date(etat.ts).toLocaleString('fr-FR')} : pas de réponse du serveur, nouvel essai à la prochaine ouverture.`) : 'Pas encore d’envoi.';
      txt += `\n\nChaque jour, vers le serveur de l’auteur (adresse non enregistrée) :\n\n${j}\n\n${dernier}`;
    } else if (Stats.relaisConfigured()) txt += '\n\nL’envoi quotidien est désactivé.';
  }
  await ask('Ce qui est envoyé', txt, [{ label: 'Fermer', value: null, kind: 'o' }]);
}

/* ============ Installation ============ */
// Android : bouton « Installer » natif. iPhone (Safari) : pas-à-pas animé. Déjà installée : rien.
let deferredInstall = null;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredInstall = e; renderInstall(); updateLandingInstall(); });
window.addEventListener('appinstalled', () => { deferredInstall = null; renderInstall(); updateLandingInstall(); });
function isStandalone() {
  try { return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true; } catch (e) { return false; }
}
function isIphoneSafari() {
  const ua = navigator.userAgent || '';
  return /iPhone|iPad|iPod/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
}
function renderInstall() {
  const box = $('#installBox');
  let off = false;
  try { off = localStorage.getItem('cave-install-off') === '1'; } catch (e) { /* stockage bloqué : on propose */ }
  if (isStandalone() || off || (!deferredInstall && !isIphoneSafari())) { box.hidden = true; box.innerHTML = ''; return; }
  box.hidden = false;
  box.innerHTML = `<div class="inst"><b>Installer « Ma cave » sur l’écran d’accueil</b><p class="small mu">Elle s’ouvre alors comme une appli, même hors connexion.</p><div class="stack"><button class="btn" id="inst-go" type="button">${deferredInstall ? 'Installer' : 'Voir comment faire'}</button><button class="lnk" id="inst-off" type="button">Ne plus afficher</button></div></div>`;
  $('#inst-go').onclick = async () => {
    if (!deferredInstall) { openSheet('sInstall'); return; }
    try { deferredInstall.prompt(); await deferredInstall.userChoice; } catch (e) { errToast('Installation impossible ici : utilisez le menu du navigateur › « Installer l’appli ».'); }
    deferredInstall = null; renderInstall();
  };
  $('#inst-off').onclick = () => { try { localStorage.setItem('cave-install-off', '1'); } catch (e) { /* */ } renderInstall(); };
}

// Première visite sur téléphone (navigateur, pas l’appli installée) : écran d’installation avant l’appli.
function isPhone() { return /Android|iPhone|iPad|iPod/.test(navigator.userAgent || ''); }
function showLanding() {
  if (!isPhone() || isStandalone()) return;
  try { if (localStorage.getItem('cave-landing-ok') === '1') return; } catch (e) { /* stockage bloqué : on montre l’écran */ }
  const ios = isIphoneSafari();
  $('#landing').hidden = false;
  $('#ld-ios').hidden = !ios;
  $('#ld-and').hidden = ios;
  updateLandingInstall();
}
function updateLandingInstall() {
  const b = $('#ld-install');
  if (!b) return;
  b.hidden = !deferredInstall;
  $('#ld-and-steps').hidden = !!deferredInstall;
}
function closeLanding() {
  try { localStorage.setItem('cave-landing-ok', '1'); } catch (e) { /* */ }
  $('#landing').hidden = true;
}
function bindLanding() {
  $('#ld-skip').onclick = closeLanding;
  $('#ld-install').onclick = async () => {
    if (!deferredInstall) { closeLanding(); return; }
    try { deferredInstall.prompt(); await deferredInstall.userChoice; } catch (e) { errToast('Installation impossible ici : utilisez le menu du navigateur › « Installer l’appli ».'); }
    deferredInstall = null; renderInstall(); updateLandingInstall();
  };
}

/* ============ Démarrage ============ */
async function boot() {
  fitViewport();
  bind();
  showQuote();
  render();
  renderInstall();
  bindLanding();
  showLanding();
  await store.open();
  try {
    const raw = await store.allWines();
    const list = raw.map(L.normalizeWine).filter(Boolean);
    const schema = await store.getMeta('schema');
    if (schema !== L.SCHEMA_VERSION) {
      // migration des données vers le format actuel (sans perte : champs normalisés)
      await store.replaceAll(list);
      await store.setMeta('schema', L.SCHEMA_VERSION);
    }
    S.wines = list;
    avisMem = (await store.getMeta('avis').catch(() => null)) || null;
    prenomMem = ((await store.getMeta('bienvenue').catch(() => null)) || {}).prenom || '';
    // point de départ : pas d’appel à l’ouverture, seulement quand la cave changera
    // avis du même numéro de version : rien à faire ; sinon (installation de la version) : un avis est préparé dès que possible
    avisCleVue = avisMem && avisMem.v === VERSION ? avisMem.cle : null;
    S.lastBackup = (await store.getMeta('lastBackup')) || 0;
    S.title = (await store.getMeta('title')) || DEFAULT_TITLE;
    renderTitle();
  } catch (e) {
    console.error(e);
    errToast('Lecture de vos données impossible : ' + (e.message || 'erreur') + '. Ne saisissez rien et restaurez votre dernière sauvegarde si le problème persiste.');
  }
  S.ready = true;
  render();
  store.protect();
  initSW();
  (async () => { await AI.initGratuit(); avisSiChange(); await loadBible(); await showBienvenue(); await showNews(); await initStats(); await askAvis(); initAuto(); })();
}
boot();
