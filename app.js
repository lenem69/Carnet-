// Interface de l'appli « Ma cave ».
import { $, $$, esc, norm, num, price, uid } from './util.js';
import * as store from './store.js';
import * as L from './logic.js';
import * as AI from './ai.js';
import * as IMP from './importer.js';
import { QUOTES } from './quotes.js';
import { saveFile, readText } from './files.js';

const VERSION = self.APP_VERSION || '?';
const YEAR = new Date().getFullYear();
const PAGE = 100;
const BACKUP_DAYS = 60;
const S = {
  wines: [], tab: 'cave', filt: 'Tous', sort: 'name', q: '', limit: PAGE, bmode: 'year',
  editId: null, formExtra: {}, lastBackup: 0, update: null, ready: false, highlight: null, title: 'Ma cave',
};
const DEFAULT_TITLE = 'Ma cave';

/* ============ Messages ============ */
function toast(msg, opt = {}) {
  const box = $('#toasts');
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

window.addEventListener('error', e => { if (e && e.message) errToast('Erreur inattendue : ' + e.message); });
window.addEventListener('unhandledrejection', e => {
  const r = e.reason;
  if (r && r.name === 'AbortError') return;
  errToast('Erreur inattendue : ' + ((r && (r.message || r.code)) || 'inconnue'));
});

const SAVE_FAIL = 'Enregistrement impossible : la mémoire du téléphone est pleine ou bloquée. Ces modifications ne sont PAS conservées. Faites vite « Sauvegarder ma cave ».';
async function persist(op) {
  try { await op(); return true; }
  catch (e) { console.error(e); errToast(SAVE_FAIL); return false; }
}

/* ============ Feuilles (fenêtres du bas) et bouton retour Android ============ */
const stack = [];
let ignorePop = 0;
let logRunning = false;
function openSheet(id) {
  if (!stack.includes(id)) {
    if (!stack.length && !(history.state && history.state.modal)) { try { history.pushState({ modal: 1 }, ''); } catch (e) { /* sans historique */ } }
    stack.push(id);
  }
  $('#' + id).classList.add('show');
}
function hideSheet(id) {
  const i = stack.indexOf(id); if (i >= 0) stack.splice(i, 1);
  $('#' + id).classList.remove('show');
  if (id === 'sDlg') settleDlg(null);
}
function closeSheet(id) {
  hideSheet(id);
  // différé : si une autre fenêtre s'ouvre juste après, on garde l'entrée d'historique
  setTimeout(() => { if (!stack.length && history.state && history.state.modal) { ignorePop++; history.back(); } }, 0);
}
window.addEventListener('popstate', () => {
  if (ignorePop) { ignorePop--; return; }
  const id = stack[stack.length - 1];
  if (!id) return;
  if (id === 'sLog' && logRunning) { try { history.pushState({ modal: 1 }, ''); } catch (e) { /* */ } return; }
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
function settleDlg(v) { const r = dlgResolve; dlgResolve = null; if (r) r(v); }
function ask(title, text, buttons) {
  return new Promise(resolve => {
    settleDlg(null);
    dlgResolve = resolve;
    $('#dlgT').textContent = title;
    $('#dlgX').textContent = text || '';
    const box = $('#dlgB'); box.innerHTML = '';
    for (const b of buttons) {
      const el = document.createElement('button');
      el.className = 'btn' + (b.kind ? ' ' + b.kind : '');
      el.textContent = b.label;
      el.onclick = () => { const r = dlgResolve; dlgResolve = null; closeSheet('sDlg'); if (r) r(b.value); };
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
  const tags = [
    w.check ? '<span class="tag bad">à vérifier</span>' : '',
    w.conf === 'estimée' ? '<span class="tag wa">fiche estimée</span>' : '',
    w.conf === 'vérifiée' ? '<span class="tag ok">fiche vérifiée</span>' : '',
    st ? `<span class="tag ${st.cls}">${st.label}${w.from || w.to ? ' (' + (w.from || '…') + '–' + (w.to || '…') + ')' : ''}</span>` : '',
    w.qty <= 0 ? '<span class="tag">plus en cave</span>' : '',
  ].filter(Boolean).join(' · ');
  const hasFiche = w.story || w.pairings.length || w.note || w.sources.length;
  const qty = mode === 'cave'
    ? `<div class="q"><button data-a="m" aria-label="Retirer une bouteille">−</button><b>${w.qty}</b><button data-a="p" aria-label="Ajouter une bouteille">+</button></div>`
    : `<b style="font-size:18px">${w.qty}×</b>`;
  return `<div class="w${w.qty <= 0 ? ' out' : ''}${S.highlight === w.id ? ' hl' : ''}" data-id="${esc(w.id)}">
  ${why ? `<p class="why">💡 ${esc(why)}</p>` : ''}
  <div class="row"><div><h4>${esc(w.name)}${w.year ? ' ' + esc(w.year) : ''}</h4><p>${esc([w.dom, w.region].filter(Boolean).join(' · '))}</p></div>${qty}</div>
  ${meta ? `<p>${meta}</p>` : ''}${tags ? `<p>${tags}</p>` : ''}
  ${hasFiche ? `<details><summary>Fiche et accords</summary>${w.story ? `<p>${esc(w.story)}</p>` : ''}${w.pairings.length ? `<p>${w.pairings.map(p => `<span class="pc">${esc(p)}</span>`).join('')}</p>` : ''}${w.note ? `<p><i>${esc(w.note)}</i></p>` : ''}${w.sources.length ? `<p class="src">Sources consultées : ${w.sources.map(x => `<a href="${esc(x.u)}" target="_blank" rel="noopener noreferrer">${esc(x.t)}</a>`).join(' · ')}</p>` : ''}</details>` : ''}
  <div class="acts">${!w.story && !w.pairings.length ? '<button class="lnk" data-a="gen">✨ Fiche (IA)</button>' : ''}<button class="lnk" data-a="e">Modifier</button>${mode === 'cave' ? '<button class="lnk" data-a="d">Supprimer</button>' : ''}</div>
</div>`;
}

function renderStats() {
  const s = L.stats(S.wines, YEAR);
  $('#sB').textContent = s.bottles.toLocaleString('fr-FR');
  $('#sV').textContent = fmtEur(s.value);
  $('#sD').textContent = s.soon.toLocaleString('fr-FR');
}

function renderBanners() {
  const out = [];
  if (S.ready && !store.persistent) out.push(`<div class="banner err"><p>Stockage indisponible sur ce navigateur (navigation privée ?). Vos données ne seront pas conservées après fermeture.</p></div>`);
  if (S.update) out.push(`<div class="banner info"><p>Nouvelle version disponible.</p><button class="btn sm" data-b="upd">Mettre à jour</button></div>`);
  if (S.ready && S.wines.length) {
    const days = S.lastBackup ? Math.floor((Date.now() - S.lastBackup) / 864e5) : null;
    if (days === null || days >= BACKUP_DAYS) out.push(`<div class="banner"><p>💾 ${days === null ? 'Aucune sauvegarde de votre cave.' : 'Dernière sauvegarde il y a ' + days + ' jours.'} Sauvegardez au moins tous les 2 mois.</p><button class="btn sm" data-b="bk">Sauvegarder</button></div>`);
  }
  $('#banners').innerHTML = out.join('');
}

function filtered() {
  return S.wines.filter(w => (S.filt === 'Tous' || (S.filt === 'À vérifier' ? w.check : w.color === S.filt)) && L.matchesQuery(w, S.q));
}

function renderList() {
  const counts = { Tous: S.wines.length, 'À vérifier': S.wines.filter(w => w.check).length };
  for (const c of L.COLORS) counts[c] = S.wines.filter(w => w.color === c).length;
  const chips = ['Tous', ...(counts['À vérifier'] || S.filt === 'À vérifier' ? ['À vérifier'] : []), ...L.COLORS.filter(c => counts[c] || S.filt === c)];
  $('#chips').innerHTML = chips.map(c => `<button class="chip${c === S.filt ? ' on' : ''}" data-c="${c}">${c} <span class="n">${counts[c] || 0}</span></button>`).join('');
  if (!S.ready) { $('#list').innerHTML = '<p class="empty">Chargement de votre cave…</p>'; return; }
  if (!S.wines.length) {
    $('#list').innerHTML = `<div class="empty"><p><b>Votre cave est vide.</b></p><p>Ajoutez vos premières bouteilles.</p><div class="stack">
      <button class="btn" data-m="cam">📷 Scanner une étiquette</button><button class="btn o" data-m="img">🖼️ Importer des photos (plusieurs)</button>
      <button class="btn o" data-m="xls">📊 Importer un tableur (Excel, CSV)</button><button class="btn o" data-m="man">✍️ Saisie manuelle</button>
      <button class="btn o" data-m="res">♻️ Restaurer une sauvegarde</button><button class="btn o" data-m="help">❔ Guide : importer toute ma cave</button></div></div>`;
    return;
  }
  const items = L.sortWines(filtered(), S.sort, YEAR);
  if (!items.length) { $('#list').innerHTML = '<p class="empty">Aucun vin ne correspond.</p>'; return; }
  const shown = items.slice(0, S.limit);
  $('#list').innerHTML = shown.map(w => card(w, 'cave')).join('') +
    (items.length > shown.length ? `<button class="btn o more" data-a="more">Afficher plus (${shown.length} sur ${items.length})</button>` : '');
}

function renderBoire() {
  const modes = [['year', 'Cette année'], ['soon', 'À boire vite'], ['dish', 'Avec un plat']];
  $('#bchips').innerHTML = modes.map(([k, l]) => `<button class="chip${k === S.bmode ? ' on' : ''}" data-b="${k}">${l}</button>`).join('');
  $('#plat').hidden = S.bmode !== 'dish';
  if (S.bmode === 'dish') return; // résultats rendus par la recherche
  const stock = S.wines.filter(w => w.qty > 0);
  const list = (S.bmode === 'year' ? stock.filter(w => L.drinkableNow(w, YEAR)) : stock.filter(w => L.urgent(w, YEAR)))
    .sort((a, b) => (a.to || 9999) - (b.to || 9999));
  const noWindow = stock.filter(w => !w.from && !w.to).length;
  const head = list.length ? `<p class="mu small">${list.length} vin${list.length > 1 ? 's' : ''} · ${list.reduce((a, w) => a + w.qty, 0)} bouteille(s)</p>` : '';
  $('#blist').innerHTML = head + (list.length ? list.map(w => card(w, 'boire')).join('')
    : `<p class="empty">${S.bmode === 'year' ? 'Aucun vin dans sa période idéale cette année.' : 'Aucun vin proche de sa fin de garde.'}</p>`) +
    (noWindow ? `<p class="empty small">${noWindow} vin(s) sans années de garde ne sont pas pris en compte.<br><button class="lnk" data-m="enr">Compléter leurs fiches (IA)</button></p>` : '');
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
  $('#vCave').hidden = S.tab !== 'cave'; $('#vBoire').hidden = S.tab !== 'boire';
  if (S.tab === 'cave') renderList(); else renderBoire();
}

/* ============ Fiche (formulaire) ============ */
const F = id => $('#f-' + id);
function openForm(w, title) {
  S.editId = w && w.id && S.wines.some(x => x.id === w.id) ? w.id : null;
  S.formExtra = { conf: (w && w.conf) || '', sources: (w && w.sources) || [] };
  $('#fT').textContent = title || (S.editId ? 'Modifier le vin' : 'Ajouter un vin');
  const v = w || {};
  F('name').value = v.name || ''; F('dom').value = v.dom || ''; F('year').value = v.year || '';
  F('color').value = L.COLORS.includes(v.color) ? v.color : 'Rouge';
  F('region').value = v.region || ''; F('grape').value = v.grape || '';
  F('qty').value = v.qty ?? 1; F('price').value = v.price !== undefined && v.price !== '' ? String(v.price).replace('.', ',') : '';
  F('from').value = v.from || ''; F('to').value = v.to || ''; F('loc').value = v.loc || '';
  F('story').value = v.story || ''; F('pairings').value = (v.pairings || []).join(', '); F('note').value = v.note || '';
  renderDatalists();
  closeSheet('sMenu');
  openSheet('sForm');
  $('#sForm .sb').scrollTop = 0;
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

async function saveForm() {
  const f = readForm();
  if (!validate(f)) return;
  delete f.priceRaw;
  if (f.qty === '') f.qty = 1;
  const now = Date.now();
  if (S.editId) {
    const old = S.wines.find(w => w.id === S.editId);
    if (!old) { errToast('Ce vin n’existe plus.'); closeSheet('sForm'); return; }
    const nw = L.normalizeWine({ ...old, ...f, check: false, conf: S.formExtra.conf || old.conf, sources: S.formExtra.sources, updated: now });
    Object.assign(old, nw);
    const ok = await persist(() => store.putWines([old]));
    finishSave(old, ok, '« ' + old.name + ' » modifié.');
    return;
  }
  const nw = L.normalizeWine({ ...f, id: uid(), conf: S.formExtra.conf, sources: S.formExtra.sources, check: false, created: now, updated: now });
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
  finishSave(nw, ok, '« ' + nw.name + ' » enregistré dans votre cave.');
}

function finishSave(w, ok, msg) {
  closeSheet('sForm');
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
  if (!requireAI()) return;
  const b = F('gen'); b.disabled = true; b.textContent = 'Génération en cours…';
  try {
    const d = await AI.makeFiche({ ...f, year: f.year });
    F('grape').value = d.grape; F('story').value = d.story;
    F('from').value = num(d.from); F('to').value = num(d.to);
    F('pairings').value = d.pairings.join(', ');
    S.formExtra.conf = d.conf; S.formExtra.sources = d.sources;
    toast(ficheMsg(d));
  } catch (e) { if (!(e && e.name === 'AbortError')) errToast(AI.errText(e)); }
  b.disabled = false; b.textContent = '✨ Générer la fiche (IA)';
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
  if (a === 'p' || a === 'm') {
    const before = w.qty;
    w.qty = Math.max(0, w.qty + (a === 'p' ? 1 : -1));
    if (w.qty === before) return;
    w.updated = Date.now();
    render();
    await persist(() => store.putWines([w]));
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
  } else if (a === 'gen') {
    if (!requireAI()) return;
    btn.disabled = true; btn.textContent = 'Génération…';
    try {
      const d = await AI.makeFiche(w);
      applyFiche(w, d);
      await persist(() => store.putWines([w]));
      render();
    } catch (err) { btn.disabled = false; btn.textContent = '✨ Fiche (IA)'; errToast(AI.errText(err)); }
  }
}

function ficheMsg(d) {
  if (d.conf === 'vérifiée') return `Fiche vérifiée sur le web (${d.sources.length} source${d.sources.length > 1 ? 's' : ''}).`;
  if (d.fallback) return 'Recherche web indisponible : fiche estimée, à vérifier.';
  if (d.searched) return 'Rien de sûr trouvé sur le web : fiche estimée, à vérifier.';
  return 'Fiche estimée (sans recherche web) : à vérifier.';
}

// Complète sans écraser ce que l'utilisateur a déjà saisi.
function applyFiche(w, d) {
  if (!w.grape && d.grape) w.grape = d.grape;
  if (!w.story && d.story) w.story = d.story;
  if (!w.from && num(d.from) !== '') w.from = num(d.from);
  if (!w.to && num(d.to) !== '') w.to = num(d.to);
  if (w.from && w.to && w.from > w.to) [w.from, w.to] = [w.to, w.from];
  if (!w.pairings.length && d.pairings.length) w.pairings = d.pairings.map(String).filter(Boolean);
  w.conf = w.conf === 'vérifiée' ? 'vérifiée' : d.conf;
  if (d.sources && d.sources.length) w.sources = d.sources;
  w.updated = Date.now();
}

function requireAI() {
  if (AI.ready()) return true;
  errToast(AI.ERR.no_key);
  openSettings();
  return false;
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
  $('#lgStop').hidden = false; $('#lgStop').disabled = false; $('#lgX').hidden = true; $('#lgMan').hidden = true;
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
  const log = openLog(`Analyse de ${files.length} photo(s)…`, files.map((f, i) => f.name || 'Photo ' + (i + 1)), 'Chaque photo prend 5 à 30 secondes. Gardez l’appli ouverte.');
  let added = 0, dups = 0, fails = 0, single = null;
  for (let i = 0; i < files.length; i++) {
    if (log.stopped) { for (let j = i; j < files.length; j++) log.set(j, 'skip', 'Non traité (arrêté)'); break; }
    log.set(i, 'run', 'Lecture de l’étiquette…');
    try {
      const d = await AI.scanLabel(files[i], { signal: log.signal, onWait: s => log.set(i, 'run', `Limite de l’IA atteinte, nouvel essai dans ${s} s…`) });
      const w = L.normalizeWine({ ...d, qty: 1, check: d.lecture !== 'haute' });
      const label = [w.name, w.dom, w.year].filter(Boolean).join(' · ');
      const ex = S.wines.find(x => L.keyOf(x) === L.keyOf(w));
      if (ex) {
        ex.qty += 1; ex.updated = Date.now(); dups++;
        const ok = await persist(() => store.putWines([ex]));
        log.set(i, ok ? 'dup' : 'err', ok ? `Déjà en cave : ${label} (${ex.qty} bouteilles)` : 'Lu, mais non enregistré (mémoire pleine)');
      } else if (files.length === 1) {
        single = w; log.set(i, 'ok', 'Reconnu : ' + label);
      } else {
        S.wines.push(w); added++;
        const ok = await persist(() => store.putWines([w]));
        log.set(i, ok ? 'ok' : 'err', ok ? 'Ajouté : ' + label + (w.check ? ' (à vérifier)' : '') : 'Lu, mais non enregistré (mémoire pleine)');
      }
      render();
    } catch (e) {
      if (e && e.name === 'AbortError') { log.set(i, 'skip', 'Arrêté'); continue; }
      fails++; log.set(i, 'err', AI.errText(e));
      if (e && (e.code === 'rate_limited' || e.code === 'bad_key' || e.code === 'no_key' || e.code === 'bad_model' || e.code === 'network')) {
        for (let j = i + 1; j < files.length; j++) log.set(j, 'skip', 'Non traité');
        break;
      }
    }
  }
  log.manual = fails > 0;
  log.finish(single ? 'Étiquette reconnue' : `Terminé : ${added} ajouté(s), ${dups} doublon(s), ${fails} échec(s)`);
  if (single) { hideSheet('sLog'); openForm(single, 'Vérifier la fiche scannée'); }
}

/* ============ Fiches par lots ============ */
async function enrichAll() {
  const todo = S.wines.filter(w => (!w.from && !w.to) || !w.pairings.length || !w.story);
  if (!todo.length) { toast('Toutes les fiches sont complètes.'); return; }
  if (!requireAI()) return;
  const calls = Math.ceil(todo.length / 10);
  const c = await ask('Compléter les fiches', `${todo.length} vin(s) à compléter, soit environ ${calls} appel(s) à l’IA (10 vins par appel). Vous pourrez arrêter à tout moment.`, [
    { label: 'Lancer', value: 'go' }, { label: 'Annuler', value: null, kind: 'o' }]);
  if (c !== 'go') return;
  const groups = []; for (let i = 0; i < todo.length; i += 10) groups.push(todo.slice(i, i + 10));
  const log = openLog('Fiches en cours…', groups.map((g, i) => `Vins ${i * 10 + 1} à ${i * 10 + g.length}`), 'Les fiches sont enregistrées au fur et à mesure.');
  let done = 0;
  for (let i = 0; i < groups.length; i++) {
    if (log.stopped) { for (let j = i; j < groups.length; j++) log.set(j, 'skip', 'Non traité (arrêté)'); break; }
    log.set(i, 'run', 'Rédaction des fiches…');
    try {
      const res = await AI.makeFiches(groups[i], { signal: log.signal, onWait: s => log.set(i, 'run', `Limite de l’IA atteinte, nouvel essai dans ${s} s…`) });
      const changed = [];
      for (const w of groups[i]) { const d = res.get(String(w.id)); if (d) { applyFiche(w, d); changed.push(w); } }
      const ok = await persist(() => store.putWines(changed));
      done += changed.length;
      log.set(i, ok ? 'ok' : 'err', ok ? `${changed.length} fiche(s) complétée(s)` : 'Non enregistré (mémoire pleine)');
      render();
    } catch (e) {
      if (e && e.name === 'AbortError') { log.set(i, 'skip', 'Arrêté'); continue; }
      log.set(i, 'err', AI.errText(e));
      if (e && ['rate_limited', 'bad_key', 'no_key', 'bad_model', 'network'].includes(e.code)) { for (let j = i + 1; j < groups.length; j++) log.set(j, 'skip', 'Non traité'); break; }
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
  const local = L.localPairing(dish, S.wines, YEAR, 5);
  const showLocal = note => {
    $('#blist').innerHTML = `<p class="mu small">${note}</p>` + (local.length ? local.map(r => card(r.w, 'boire', r.why)).join('')
      : '<p class="empty">Aucune suggestion : complétez les accords de vos fiches (✨ Fiche) ou configurez une IA dans Réglages.</p>');
  };
  if (!AI.ready()) { showLocal('Suggestions sans IA, d’après les accords enregistrés et la couleur.'); return; }
  // présélection locale : l'IA ne reçoit que 40 vins au plus, quel que soit la taille de la cave
  const pre = L.localPairing(dish, S.wines, YEAR, 40).map(r => r.w);
  if (pre.length < 40) {
    for (const w of L.sortWines(stock, 'urgent', YEAR)) {
      if (pre.length >= 40) break;
      const st = L.status(w, YEAR);
      if (!pre.includes(w) && !(st && st.code === 'keep')) pre.push(w);
    }
  }
  if (!pre.length) { showLocal('Aucun vin prêt à boire.'); return; }
  const b = $('#go'); b.disabled = true; b.textContent = 'Recherche…';
  $('#blist').innerHTML = '<p class="empty">L’IA choisit parmi vos vins…</p>';
  try {
    const picks = await AI.pickForDish(dish, pre);
    const out = picks.map(p => ({ w: S.wines.find(w => w.id === p.id), why: p.why })).filter(x => x.w);
    if (!out.length) showLocal('L’IA n’a rien proposé. Suggestions sans IA :');
    else $('#blist').innerHTML = '<p class="mu small">Choix de l’IA parmi vos vins prêts à boire.</p>' + out.map(x => card(x.w, 'boire', x.why)).join('');
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
  catch (e) { t.remove(); errToast('Lecture du fichier impossible : ' + (e.message || 'format non reconnu') + '. Utilisez un fichier .xlsx ou .csv avec une ligne d’en-têtes.'); return; }
  t.remove();
  if (!rows.length) { errToast('Fichier vide ou sans ligne d’en-têtes.'); return; }
  let r = IMP.rowsToWines(rows, S.wines);
  let ignored = 0;
  if (!r.added.length && !r.updated.length) {
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
    S.wines = parsed.wines; S.limit = PAGE; render();
    toast(`✅ Cave restaurée : ${parsed.wines.length} vin(s).`, { action: before.length ? { label: 'Annuler', fn: async () => {
      if (await persist(() => store.replaceAll(before))) { S.wines = before; render(); toast('Restauration annulée.'); }
    } } : null });
  } else {
    const keys = new Set(S.wines.map(L.keyOf)); const ids = new Set(S.wines.map(w => w.id));
    const add = parsed.wines.filter(w => !keys.has(L.keyOf(w))).map(w => ids.has(w.id) ? { ...w, id: uid() } : w);
    if (!add.length) { toast('Tous les vins de la sauvegarde sont déjà dans votre cave.'); return; }
    if (!await persist(() => store.putWines(add))) return;
    S.wines = S.wines.concat(add); render();
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
  const on = AI.configured();
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
  $('#ai-guide').hidden = AI.ready();
  $('#st-ver').textContent = VERSION;
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
  $('#ai-guide').hidden = AI.ready();
  if (!silent) toast(v.key ? '✅ Réglages IA enregistrés.' : 'Clé retirée pour ce fournisseur.');
  return true;
}
async function testAi() {
  if (!saveAi(true)) return;
  const prov = $('#ai-prov').value;
  if (!AI.configured().includes(prov)) { errToast('Saisissez d’abord une clé pour ce fournisseur.'); return; }
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
function menuAction(m) {
  const pick = id => { closeSheet('sMenu'); $(id).click(); };
  if (m === 'cam') { if (requireAI()) pick('#fCam'); }
  else if (m === 'img') { if (requireAI()) pick('#fImg'); }
  else if (m === 'xls') pick('#fXls');
  else if (m === 'man') openForm(null);
  else if (m === 'enr') { closeSheet('sMenu'); enrichAll(); }
  else if (m === 'bk') doBackup();
  else if (m === 'res') pick('#fJson');
  else if (m === 'csv') exportCsv();
  else if (m === 'help') { closeSheet('sMenu'); openSheet('sHelp'); }
}

function bind() {
  $('#fab').onclick = () => openSheet('sMenu');
  $('#bSet').onclick = openSettings;
  $('#bTitle').onclick = openTitle;
  $('#appTitle').onclick = openTitle;
  $('#ti-save').onclick = () => saveTitle($('#ti-in').value);
  $('#ti-reset').onclick = () => saveTitle('');
  $('#ti-in').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); saveTitle($('#ti-in').value); } });
  $('#sMenu').addEventListener('click', e => { const b = e.target.closest('[data-m]'); if (b) menuAction(b.dataset.m); });
  $$('[data-close]').forEach(b => { b.onclick = () => closeSheet(b.dataset.close); });
  $$('.modal').forEach(m => m.addEventListener('click', e => {
    if (e.target !== m) return;
    if (m.id === 'sLog' && logRunning) return;
    if (m.id === 'sForm') return; // évite de perdre une saisie par un toucher à côté
    closeSheet(m.id);
  }));
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape' || !stack.length) return;
    const id = stack[stack.length - 1];
    if (id === 'sLog' && logRunning) return;
    closeSheet(id);
  });

  $$('.tab').forEach(b => { b.onclick = () => { S.tab = b.dataset.t; render(); }; });
  $('#chips').onclick = e => { const b = e.target.closest('[data-c]'); if (b) { S.filt = b.dataset.c; S.limit = PAGE; renderList(); } };
  $('#bchips').onclick = e => { const b = e.target.closest('[data-b]'); if (b) { S.bmode = b.dataset.b; $('#blist').innerHTML = ''; renderBoire(); } };
  let qt;
  $('#q').addEventListener('input', () => { clearTimeout(qt); qt = setTimeout(() => { S.q = $('#q').value; S.limit = PAGE; renderList(); }, 150); });
  $('#sort').onchange = () => { S.sort = $('#sort').value; S.limit = PAGE; renderList(); };
  $('#list').addEventListener('click', onCardAction);
  $('#blist').addEventListener('click', onCardAction);
  $('#banners').addEventListener('click', e => { const b = e.target.closest('[data-b]'); if (!b) return; if (b.dataset.b === 'bk') doBackup(); else if (b.dataset.b === 'upd') applyUpdate(); });
  $('#go').onclick = findForDish;

  F('save').onclick = saveForm;
  F('cancel').onclick = () => closeSheet('sForm');
  F('gen').onclick = genInForm;

  const onFiles = (id, fn) => { $(id).addEventListener('change', e => { const fl = [...e.target.files]; e.target.value = ''; if (fl.length) fn(fl); }); };
  onFiles('#fCam', scanFiles); onFiles('#fImg', scanFiles);
  onFiles('#fXls', fl => importSheet(fl[0])); onFiles('#fJson', fl => doRestore(fl[0]));

  $('#lgStop').onclick = null;
  $('#lgX').onclick = () => closeSheet('sLog');
  $('#lgMan').onclick = () => { hideSheet('sLog'); openForm(null); };

  $('#ai-prov').onchange = () => fillAiFields($('#ai-prov').value);
  AI.hooks.onSwitch = (from, to, e) => toast(`${AI.PROVIDERS[from].label.split(' ')[0]} indisponible (${AI.errText(e).replace(/\.$/, '').slice(0, 60)}) : ${AI.PROVIDERS[to].label.split(' ')[0]} prend le relais.`);
  $('#ai-show').onclick = () => { const k = $('#ai-key'); const show = k.type === 'password'; k.type = show ? 'text' : 'password'; $('#ai-show').textContent = show ? 'Masquer' : 'Voir'; };
  $('#ai-open').onclick = () => { try { window.open('https://aistudio.google.com/apikey', '_blank', 'noopener,noreferrer'); } catch (e) { errToast('Ouvrez aistudio.google.com dans votre navigateur.'); } };
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

/* ============ Démarrage ============ */
async function boot() {
  fitViewport();
  bind();
  showQuote();
  render();
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
}
boot();
