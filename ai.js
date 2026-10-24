// IA optionnelle : lecture d'étiquettes, fiches, accords. Fournisseur au choix, clé saisie par l'utilisateur.
// L'appli fonctionne entièrement sans IA ; ce module n'est appelé que sur action explicite.
import { sleep } from './util.js';
import { normColor } from './logic.js';
import * as store from './store.js';

export const PROVIDERS = {
  gemini: { label: 'Gemini (Google)', model: 'gemini-3.5-flash-lite', help: 'Clé gratuite sur aistudio.google.com → « Get API key ». Pour mieux lire les étiquettes difficiles : gemini-3.8-flash.' },
  anthropic: { label: 'Claude (Anthropic)', model: 'claude-haiku-5-5', help: 'Clé API payante sur console.anthropic.com (différente d’un abonnement Claude.ai).' },
  openai: { label: 'ChatGPT / compatible OpenAI', model: 'gpt-4o-mini', base: 'https://api.openai.com/v1', help: 'Clé API prépayée sur platform.openai.com (différente d’un abonnement ChatGPT). Modèle conseillé : gpt-4o-mini (un nom sans espace). Marche aussi avec Mistral, Groq, OpenRouter… : changez l’adresse et le modèle.' },
};

export const cfg = { retryDelay: 20000, retries: 2, timeout: 90000 };
// Modèle par tâche, invisible pour l'utilisateur. La lecture d'étiquette prend le modèle le plus précis ;
// les fiches en lot et les accords restent sur le modèle économique. Un modèle choisi à la main n'est jamais remplacé.
const MODELE_TACHE = { label: { gemini: 'gemini-3.8-flash' } };
const modelFor = (prov, task, model) => (model !== PROVIDERS[prov].model ? model : (MODELE_TACHE[task] && MODELE_TACHE[task][prov]) || model);

const KEY = 'cave-ai';
const COOL = 'cave-ai-cool';
// Ordre de préférence : le gratuit d’abord, puis le moins cher.
export const ORDER = ['gemini', 'openai', 'anthropic'];
export const hooks = { onSwitch: null, onStat: null };
const stat = k => { try { if (hooks.onStat) hooks.onStat(k); } catch (e) { /* les statistiques ne doivent jamais gêner */ } };
const STAT_OF = { rate_limited: 'ia_limite', bad_key: 'ia_cle', bad_model: 'ia_cle', bad_base: 'ia_cle', no_key: 'ia_cle', network: 'ia_reseau', timeout: 'ia_reseau', server: 'ia_reseau' };

// Réglages : une configuration par fournisseur. Ancien format (un seul fournisseur) migré à la lecture.
function readRaw() {
  let r = {};
  try { r = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { r = {}; }
  let list = {};
  if (r.list && typeof r.list === 'object') list = { ...r.list };
  else if (PROVIDERS[r.provider] && r.key) list[r.provider] = { key: r.key, model: r.model, base: r.base };
  return { provider: PROVIDERS[r.provider] ? r.provider : '', list };
}
export function getConfig(provider) {
  const c = (readRaw().list[provider]) || {};
  const d = PROVIDERS[provider];
  return { key: String(c.key || '').trim(), model: c.model || d.model, base: c.base || d.base || '' };
}
// Clé gratuite partagée (proxy) : utilisée seulement tant que l’appareil n’a pas atteint sa limite du jour, et seulement
// si aucune clé personnelle n’est saisie. Hors ligne ou désactivée (cave-gratuit = off, pour les tests), elle n’existe pas.
export const PROXY = 'https://cave-ia.m-jeanfrancois-morin.workers.dev';
export const LIMITE_GRATUITE = 1;   // vin par jour et par appareil : une seule action d’IA gratuite par jour, tout le reste est bridé
let gratuit = { jour: '', vins: 0 };
let appareil = '';
const aujourdhui = () => new Date().toISOString().slice(0, 10);
export async function initGratuit() {
  try {
    appareil = (await store.getMeta('appareil')) || '';
    if (!appareil) {
      appareil = (globalThis.crypto && crypto.randomUUID) ? crypto.randomUUID() : (Date.now().toString(36) + Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2));
      await store.setMeta('appareil', appareil);
    }
  } catch (e) { /* sans identifiant, la clé gratuite n’est pas proposée */ }
  try { const g = await store.getMeta('gratuit'); if (g && g.jour === aujourdhui()) gratuit = { jour: g.jour, vins: g.vins || 0 }; } catch (e) { /* compteur à zéro */ }
  syncCfg();
}
const gratuitActif = () => { try { return localStorage.getItem('cave-gratuit') !== 'off'; } catch (e) { return true; } };
export const gratuitReste = () => Math.max(0, LIMITE_GRATUITE - (gratuit.jour === aujourdhui() ? gratuit.vins : 0));
// Mode Gemini : « direct » (clé personnelle), « gratuit » (clé partagée, sous la limite) ou '' (aucun).
const modeGemini = () => { if (getConfig('gemini').key) return 'direct'; return appareil && gratuitActif() && gratuitReste() > 0 ? 'gratuit' : ''; };
const gratuitBloque = () => !!appareil && gratuitActif() && !getConfig('gemini').key && gratuitReste() === 0;
// Pour un lot : en mode gratuit, on ne demande que ce qui reste sous la limite du jour.
export function capGratuit(list) { return modeGemini() === 'gratuit' ? list.slice(0, Math.max(1, gratuitReste())) : list; }
async function compter(n) {
  const jour = aujourdhui();
  if (gratuit.jour !== jour) gratuit = { jour, vins: 0 };
  // La passe de fond peut avoir compté entre-temps : on repart du compteur enregistré.
  try { const g = await store.getMeta('gratuit'); if (g && g.jour === jour && g.vins > gratuit.vins) gratuit.vins = g.vins; } catch (e) { /* compteur local */ }
  gratuit.vins += n;
  try { await store.setMeta('gratuit', { ...gratuit }); } catch (e) { /* le compteur reste en mémoire pour cette session */ }
}
export const configured = () => ORDER.filter(p => (p === 'gemini' ? !!modeGemini() : getConfig(p).key));
export function getSettings() {
  const r = readRaw();
  const provider = r.provider || configured()[0] || 'gemini';
  return { provider, ...getConfig(provider) };
}
export function setSettings(s) {
  const r = readRaw();
  const key = (s.key || '').trim();
  if (key) r.list[s.provider] = { key, model: (s.model || '').trim(), base: (s.base || '').trim().replace(/\/+$/, '') };
  else delete r.list[s.provider];
  localStorage.setItem(KEY, JSON.stringify({ v: 2, provider: s.provider, list: r.list }));
  try { localStorage.removeItem(COOL); } catch (e) { /* sans effet */ }
  syncCfg();
}
// Copie des clés dans IndexedDB (sur le téléphone seulement) : le service worker en a besoin pour la passe de fond.
export function syncCfg() {
  try { store.setMeta('aiCfg', readRaw().list).catch(() => {}); } catch (e) { /* sans effet */ }
  try { store.setMeta('gratuitOn', gratuitActif()).catch(() => {}); } catch (e) { /* sans effet */ }
}
export const ready = () => configured().length > 0;
export const limiteAtteinte = () => gratuitBloque();
// L’avis de Magic se prépare tout seul à chaque changement : il ne consomme jamais la clé gratuite, seulement une clé personnelle.
export const avisPossible = () => configured().some(p => p !== 'gemini' || !!getConfig('gemini').key);

// Fournisseurs mis de côté un moment (crédits épuisés, clé refusée…), pour ne pas les réessayer à chaque demande.
function cooled() {
  try { const c = JSON.parse(localStorage.getItem(COOL) || '{}') || {}; const now = Date.now(); return Object.keys(c).filter(k => c[k] > now); } catch (e) { return []; }
}
function cool(provider, e) {
  const min = { rate_limited: 60, bad_key: 1440, bad_model: 1440, bad_base: 1440, server: 5 }[e && e.code];
  if (!min) return;
  try { const c = JSON.parse(localStorage.getItem(COOL) || '{}') || {}; c[provider] = Date.now() + min * 60000; localStorage.setItem(COOL, JSON.stringify(c)); } catch (x) { /* sans effet */ }
}
function uncool(provider) {
  try { const c = JSON.parse(localStorage.getItem(COOL) || '{}') || {}; if (c[provider]) { delete c[provider]; localStorage.setItem(COOL, JSON.stringify(c)); } } catch (x) { /* sans effet */ }
}
// Fournisseurs à essayer, dans l’ordre. Si tous sont mis de côté, on les réessaie quand même.
export function usable() {
  const all = configured(); const off = cooled();
  const ok = all.filter(p => !off.includes(p));
  return ok.length ? ok : all;
}

export const ERR = {
  no_key: 'Aucune IA configurée. Ajoutez une clé dans Réglages (⚙).',
  limite_gratuite: 'Vous avez utilisé l’IA gratuite d’aujourd’hui (un vin par jour), elle revient demain. Pour l’utiliser sans cette limite, ajoutez votre propre clé gratuite dans ⚙ Réglages : la marche à suivre y est expliquée pas à pas.',
  bad_key: 'Clé IA refusée. Vérifiez-la dans Réglages (⚙).',
  service_gratuit: 'Le service gratuit est momentanément indisponible. Réessayez plus tard, ou ajoutez votre propre clé gratuite dans ⚙ Réglages.',
  bad_model: 'Modèle IA introuvable. Corrigez le nom du modèle dans Réglages (⚙).',
  rate_limited: 'Limite d’utilisation de l’IA atteinte (par minute ou par jour). Réessayez plus tard.',
  network: 'Pas de connexion à l’IA. Vérifiez votre réseau.',
  server: 'Le service d’IA est indisponible pour le moment. Réessayez.',
  blocked: 'L’IA a refusé d’analyser cette demande.',
  invalid_json: 'L’IA a répondu dans un format illisible. Réessayez.',
  timeout: 'Délai dépassé (plus de 90 s). Vérifiez votre connexion et réessayez.',
  bad_image: 'Photo illisible (format non pris en charge).',
  not_label: 'Aucune étiquette de vin lisible sur cette photo.',
  bad_base: 'Adresse de l’API manquante ou invalide (Réglages ⚙).',
};
export function errText(e) {
  const c = (e && e.code) || '';
  const m = (e && e.message) || '';
  if (c === 'service_gratuit') return ERR[c] + (m ? ' (' + String(m).slice(0, 120) + ')' : '');
  if (ERR[c]) return ERR[c];
  return 'Erreur inattendue' + (c || m ? ' [' + [c, m].filter(Boolean).join(' – ') + ']' : '') + '.';
}

const toB64 = blob => new Promise((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(String(r.result).split(',')[1]);
  r.onerror = () => reject({ code: 'bad_image' });
  r.readAsDataURL(blob);
});

// Réduit la photo (800 px, JPEG) : lecture identique, coût bien moindre.
export async function shrinkImage(file) {
  try {
    const bm = await createImageBitmap(file);
    const s = Math.min(1, 800 / Math.max(bm.width, bm.height));
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(bm.width * s)); c.height = Math.max(1, Math.round(bm.height * s));
    c.getContext('2d').drawImage(bm, 0, 0, c.width, c.height);
    if (bm.close) bm.close();
    const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.7));
    if (!blob) throw new Error('toBlob');
    return blob;
  } catch (e) { throw { code: 'bad_image' }; }
}

export function parseJsonLoose(t) {
  const s = String(t || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
  try { return JSON.parse(s); } catch (e) { /* on tente d'extraire */ }
  const i = s.search(/[[{]/); const j = Math.max(s.lastIndexOf('}'), s.lastIndexOf(']'));
  if (i >= 0 && j > i) { try { return JSON.parse(s.slice(i, j + 1)); } catch (e) { /* illisible */ } }
  throw { code: 'invalid_json' };
}

async function httpJson(url, init) {
  let r;
  try { r = await fetch(url, init); }
  catch (e) { if (e && e.name === 'AbortError') throw e; throw { code: 'network' }; }
  let j = null; try { j = await r.json(); } catch (e) { j = null; }
  const raw = j && j.error;
  const msg = (typeof raw === 'string' ? raw : raw && (raw.message || raw.type)) || '';
  if (!r.ok) {
    if (r.status === 429) throw { code: 'rate_limited', message: msg };
    if (r.status === 401 || r.status === 403 || /api[ _-]?key|authentication|unauthori/i.test(msg)) throw { code: 'bad_key', message: msg };
    if (r.status === 404 || /model/i.test(msg) && r.status === 400) throw { code: 'bad_model', message: msg };
    throw { code: 'server', message: r.status + (msg ? ' ' + msg : '') };
  }
  return j || {};
}

// Sites réellement consultés par Gemini (https uniquement, 5 au maximum, sans doublon).
export function webSources(cand) {
  const ch = (cand && cand.groundingMetadata && cand.groundingMetadata.groundingChunks) || [];
  const seen = new Set(); const res = [];
  for (const x of ch) {
    const w = x && x.web; if (!w || typeof w.uri !== 'string' || !/^https:\/\//i.test(w.uri)) continue;
    const t = String(w.title || '').trim().slice(0, 80) || 'Source';
    const k = t.toLowerCase();
    if (seen.has(k)) continue; seen.add(k);
    res.push({ t, u: w.uri });
    if (res.length >= 5) break;
  }
  return res;
}

async function callOnce(s, prompt, images, signal, out) {
  if (!s.key && !s.gratuit) throw { code: 'no_key' };
  const b64 = [];
  for (const im of images) b64.push(await toB64(im));
  if (s.provider === 'anthropic') {
    const content = b64.map(d => ({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: d } }));
    content.push({ type: 'text', text: prompt });
    const j = await httpJson('https://api.anthropic.com/v1/messages', {
      method: 'POST', signal,
      headers: { 'content-type': 'application/json', 'x-api-key': s.key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
      body: JSON.stringify({ model: s.model, max_tokens: 4096, messages: [{ role: 'user', content }] }),
    });
    const t = (j.content || []).filter(p => p.type === 'text').map(p => p.text).join('');
    if (!t) throw { code: j.stop_reason === 'refusal' ? 'blocked' : 'invalid_json' };
    return parseJsonLoose(t);
  }
  if (s.provider === 'openai') {
    if (!/^https:\/\//.test(s.base)) throw { code: 'bad_base' };
    const content = [{ type: 'text', text: prompt }, ...b64.map(d => ({ type: 'image_url', image_url: { url: 'data:image/jpeg;base64,' + d } }))];
    const j = await httpJson(s.base + '/chat/completions', {
      method: 'POST', signal,
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + s.key },
      body: JSON.stringify({ model: s.model, messages: [{ role: 'user', content }], response_format: { type: 'json_object' }, temperature: 0.2 }),
    });
    const t = j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content;
    if (!t) throw { code: 'invalid_json' };
    return parseJsonLoose(t);
  }
  // Gemini ; avec `wantSearch`, il consulte le web (Google Search) avant de répondre.
  const parts = [{ text: prompt }, ...b64.map(d => ({ inline_data: { mime_type: 'image/jpeg', data: d } }))];
  const call = search => httpJson((s.gratuit ? PROXY : 'https://generativelanguage.googleapis.com') + '/v1beta/models/' + encodeURIComponent(s.model) + ':generateContent', {
    method: 'POST', signal,
    headers: s.gratuit ? { 'Content-Type': 'application/json', 'x-appareil': appareil, 'x-unites': String(s.unites || 1) } : { 'Content-Type': 'application/json', 'x-goog-api-key': s.key },
    body: JSON.stringify(search
      ? { contents: [{ role: 'user', parts }], tools: [{ google_search: {} }], generationConfig: { temperature: 0.2 } }
      : { contents: [{ role: 'user', parts }], generationConfig: { responseMimeType: 'application/json', temperature: 0.2 } }),
  });
  let search = !!(out && out.wantSearch);
  let j;
  try { j = await call(search); }
  catch (e) {
    // La recherche web est un plus : si le service la refuse, on refait la demande sans elle.
    if (!(search && e && e.code === 'server')) throw e;
    search = false; if (out) out.fallback = true;
    j = await call(false);
  }
  if (out) { out.searched = search; out.sources = []; }
  const c = j.candidates && j.candidates[0];
  if (search && out) out.sources = webSources(c);
  const t = c && c.content && c.content.parts ? c.content.parts.map(p => p.text || '').join('') : '';
  if (!t) throw { code: j.promptFeedback && j.promptFeedback.blockReason ? 'blocked' : 'invalid_json' };
  return parseJsonLoose(t);
}

// Une tentative chez un fournisseur donné, avec délai maximal, arrêt possible et nouvel essai si la limite par minute est atteinte.
async function callProvider(s, prompt, { images = [], signal, onWait, out } = {}, retries) {
  for (let attempt = 0; ; attempt++) {
    const ac = new AbortController();
    const stop = () => ac.abort();
    if (signal) { if (signal.aborted) throw Object.assign(new Error('abort'), { name: 'AbortError' }); signal.addEventListener('abort', stop, { once: true }); }
    const timer = setTimeout(() => { ac.timedOut = true; ac.abort(); }, cfg.timeout);
    try {
      return await callOnce(s, typeof prompt === 'function' ? prompt(s) : prompt, images, ac.signal, out);
    } catch (e) {
      if (e && e.name === 'AbortError') { if (ac.timedOut) throw { code: 'timeout' }; throw e; }
      if (e && e.code === 'rate_limited' && attempt < retries) {
        if (onWait) onWait(Math.round(cfg.retryDelay / 1000));
        await sleep(cfg.retryDelay, signal);
        continue;
      }
      throw e;
    } finally {
      clearTimeout(timer);
      if (signal) signal.removeEventListener('abort', stop);
    }
  }
}

// Choix automatique de l’IA : on prend la première disponible (gratuit d’abord) ; si elle est épuisée ou en panne,
// on passe tout de suite à la suivante. Le délai d’attente n’est utilisé que s’il ne reste plus d’autre choix.
// `only` force un fournisseur (test de connexion).
export async function callJson(prompt, opts = {}) {
  const list = opts.only ? configured().filter(p => p === opts.only) : usable();
  if (!list.length) throw { code: gratuitBloque() ? 'limite_gratuite' : 'no_key' };
  let lastErr;
  for (let i = 0; i < list.length; i++) {
    const prov = list[i]; const last = i === list.length - 1;
    const s = { provider: prov, ...getConfig(prov) };
    if (prov === 'gemini' && !s.key) { s.gratuit = true; s.unites = Math.max(1, opts.unites || 1); }
    s.model = modelFor(prov, opts.task, s.model);
    try {
      const r = await callProvider(s, prompt, opts, last && !opts.noRetry ? cfg.retries : 0);
      uncool(prov); stat('ia_ok');
      if (s.gratuit) await compter(s.unites);
      if (opts.out) opts.out.provider = prov;
      return r;
    } catch (e) {
      if (e && e.name === 'AbortError') throw e;
      // la clé partagée est épuisée côté serveur : on le dit comme une limite du jour, pas comme une panne
      if (s.gratuit && e && e.code === 'rate_limited') e = { code: 'limite_gratuite' };
      // refus ou panne du service gratuit : ce n’est pas la clé de l’utilisateur, on ne lui demande donc pas de la vérifier
      else if (s.gratuit && e && ['bad_key', 'bad_model', 'server'].includes(e.code)) e = { code: 'service_gratuit', message: e.message || '' };
      lastErr = e;
      const code = e && e.code;
      if (STAT_OF[code]) stat(STAT_OF[code]);
      const sticky = !['bad_image', 'not_label', 'blocked'].includes(code);
      if (!opts.only && sticky) cool(prov, e);
      if (last || !sticky) throw e;
      stat('ia_relais');
      if (hooks.onSwitch) hooks.onSwitch(prov, list[i + 1], e);
    }
  }
  throw lastErr;
}

/* ---------- Demandes métier ---------- */
const SCHEMA_LABEL = '{"name":"cuvée","dom":"domaine/château","year":2019,"color":"Rouge|Blanc|Rosé|Pétillant|Autre","region":"appellation","grape":"cépages","lecture":"haute si tout est lisible, moyenne si tu as dû deviner une partie, faible sinon"}';
const SCHEMA_FICHE = '{"grape":"cépages","story":"2-3 phrases sur la cuvée, le domaine et le millésime","from":année de début de garde,"to":année de fin de garde,"pairings":["4 à 6 plats précis"],"conf":"vérifiée si les pages web consultées confirment cette cuvée, ce millésime et la fenêtre de garde, sinon estimée"}';
const EXPERT = 'Tu es un sommelier expert de 30 ans d’expérience, qui connaît les grands guides (RVF, Bettane+Desseauve, Parker, Decanter).';

export async function scanLabel(file, opts) {
  const blob = await shrinkImage(file);
  const d = await callJson(`${EXPERT} L’image est la photo d’une étiquette de bouteille de vin. Lis l’étiquette et identifie le vin. N’invente jamais un nom : écris ce que tu lis. Réponds uniquement par un objet JSON de ce format : ${SCHEMA_LABEL}. Si l’image n’est pas une étiquette de vin lisible, réponds {"error":true}.`, { ...opts, images: [blob], task: 'label' });
  if (!d || typeof d !== 'object' || d.error || !(d.name || d.dom)) throw { code: 'not_label' };
  return { name: d.name || d.dom, dom: d.dom || '', year: d.year, color: normColor(d.color), region: d.region || '', grape: d.grape || '', lecture: String(d.lecture || '').toLowerCase().startsWith('haute') ? 'haute' : 'douteuse' };
}

export async function makeFiche(w, opts = {}) {
  const year = new Date().getFullYear();
  // Recherche web seulement chez Gemini ; chez un autre fournisseur, la fiche reste une estimation.
  const ask = s => { const web = s.provider === 'gemini'; return `${EXPERT} ${web ? 'Utilise la recherche web et croise plusieurs sources fiables : site du domaine, guides et revues (RVF, Bettane+Desseauve, Parker, Decanter), forums spécialisés (La Passion du Vin, CellarTracker…), sites de vente en ligne avec fiches produit (Vinatis, V and B, Millésima, Idealwine…), cavistes et notes de dégustation. Compare les fenêtres de garde données par ces sources puis complète la fiche' : 'Complète la fiche de ce vin avec tes connaissances (estime si la cuvée t’est inconnue, sans inventer de faits précis)'} : ${JSON.stringify({ name: w.name, dom: w.dom, year: w.year, color: w.color, region: w.region })}. Nous sommes en ${year}. Ne donne jamais une date de garde précise sans base : en cas de doute, élargis la fourchette et mets conf à « estimée » ; ne retiens « vérifiée » que si au moins deux sources concordent ou si la source est le domaine lui-même. Réponds uniquement par un objet JSON de ce format : ${SCHEMA_FICHE}.`; };
  const out = { wantSearch: true };
  const d = await callJson(ask, { ...opts, out });
  if (!d || typeof d !== 'object' || Array.isArray(d)) throw { code: 'invalid_json' };
  const f = ficheFrom(d);
  const sources = out.searched ? (out.sources || []) : [];
  // « vérifiée » seulement si le modèle l’affirme ET que des pages web ont réellement été consultées.
  f.conf = sources.length && /^v[ée]rifi/i.test(String(d.conf || d.c || '')) ? 'vérifiée' : 'estimée';
  f.sources = sources;
  f.searched = !!out.searched;
  f.fallback = !!out.fallback;
  return f;
}

// Libellés envoyés par le modèle (« u ») vers les champs de la fiche.
const DOUTE_LIBELLE = { 'cépage': 'grape', histoire: 'story', garde: 'from', accords: 'pairings' };
function mapDoute(v) { return Array.isArray(v) ? [...new Set(v.map(x => DOUTE_LIBELLE[String(x).toLowerCase()]).filter(Boolean))] : []; }

// Fourchette de valeur [min, max] donnée avec la fiche (estimation sans recherche).
function estimOf(v) {
  const min = Number(Array.isArray(v) ? v[0] : 0), max = Number(Array.isArray(v) ? v[1] : 0);
  return min > 0 ? { min, max: max >= min ? max : min } : null;
}

function ficheFrom(d) {
  return {
    estim: estimOf(d.v),
    doute: mapDoute(d.u || d.doute),
    grape: String(d.grape || d.g || ''),
    story: String(d.story || d.s || ''),
    from: d.from ?? d.f, to: d.to ?? d.t,
    pairings: Array.isArray(d.pairings || d.p) ? (d.pairings || d.p).map(String) : [],
    conf: 'estimée', // sans recherche web, une fiche n’est jamais « vérifiée »
    sources: [],
  };
}

// 10 vins par appel : 10 fois moins d'appels que vin par vin.
export async function makeFiches(list, opts) {
  list = capGratuit(list); opts = { ...(opts || {}), unites: list.length };
  const year = new Date().getFullYear();
  const d = await callJson(`${EXPERT} Pour chaque vin de la liste, complète ou corrige si besoin : g=cépages, s=histoire de la cuvée et du millésime en 1 à 2 phrases, f=année de début de garde, t=année de fin de garde (nous sommes en ${year}), p=4 accords mets courts, u=liste des champs que tu ne connais pas sûrement parmi "cépage", "histoire", "garde", "accords" (liste vide si tu es sûr), v=[min,max] fourchette indicative du prix en euros d’une bouteille de 75 cl (sans recherche), c="estimée". Vins : ${JSON.stringify(list.map(w => ({ id: w.id, n: w.name, d: w.dom, y: w.year, c: w.color, r: w.region })))}. Réponds uniquement par un objet JSON {"items":[{"id":"…","g":"…","s":"…","f":2026,"t":2030,"p":["…"],"u":[],"v":[20,40],"c":"estimée"}]} avec une entrée par vin.`, opts);
  const items = Array.isArray(d) ? d : d && Array.isArray(d.items) ? d.items : null;
  if (!items) throw { code: 'invalid_json' };
  const out = new Map();
  for (const x of items) if (x && x.id != null) out.set(String(x.id), ficheFrom(x));
  return out;
}

// Recherche web par lot (quelques vins par appel) : une seule requête ; les sources sont partagées par le lot.
export async function makeFichesWeb(list, opts = {}) {
  list = capGratuit(list); opts = { ...opts, unites: list.length };
  const year = new Date().getFullYear();
  const out = { wantSearch: true };
  const d = await callJson(`${EXPERT} Utilise la recherche web et croise des sources fiables (site du domaine, guides et revues, cavistes). Pour chaque vin de la liste, complète : g=cépages, s=histoire de la cuvée en 1 à 2 phrases, f=année de début de garde, t=année de fin de garde (nous sommes en ${year}), p=4 accords mets courts, c="vérifiée" seulement si les pages consultées confirment cette cuvée et ce millésime, sinon "estimée". Ne donne jamais une fenêtre de garde sans base ; en cas de doute, élargis-la. Vins : ${JSON.stringify(list.map(w => ({ id: w.id, n: w.name, d: w.dom, y: w.year, c: w.color, r: w.region })))}. Réponds uniquement par un objet JSON {"items":[{"id":"…","g":"…","s":"…","f":2026,"t":2030,"p":["…"],"c":"estimée"}]} avec une entrée par vin.`, { ...opts, out });
  const items = Array.isArray(d) ? d : d && Array.isArray(d.items) ? d.items : null;
  if (!items) throw { code: 'invalid_json' };
  const sources = out.searched ? (out.sources || []) : [];
  const res = new Map();
  for (const x of items) {
    if (!x || x.id == null) continue;
    const f = ficheFrom(x);
    f.conf = sources.length && /^v[ée]rifi/i.test(String(x.c || '')) ? 'vérifiée' : 'estimée';
    f.sources = sources;
    f.searched = !!out.searched;
    f.fallback = !!out.fallback;
    res.set(String(x.id), f);
  }
  return res;
}

// Choix parmi des candidats déjà présélectionnés localement (coût limité, quelle que soit la taille de la cave).
export async function pickForDish(dish, candidates, opts) {
  const year = new Date().getFullYear();
  const cat = candidates.map(w => ({ id: w.id, n: w.name, d: w.dom, y: w.year, c: w.color, g: w.grape, r: w.region, de: w.from, a: w.to, acc: w.pairings.join(', ') }));
  const d = await callJson(`Tu es sommelier. Plat prévu : « ${dish} ». Année en cours : ${year}. Voici des vins de ma cave (id, nom, domaine, millésime, couleur, cépage, région, début et fin de garde, accords) : ${JSON.stringify(cat)}. Choisis les 3 à 5 meilleurs vins pour ce plat, en privilégiant ceux qui sont dans leur fenêtre de dégustation et à boire en priorité (fin de garde proche) à qualité d’accord comparable. Réponds uniquement par un objet JSON {"items":[{"id":"…","why":"une phrase : pourquoi cet accord et ce moment"}]}.`, opts);
  const items = Array.isArray(d) ? d : d && Array.isArray(d.items) ? d.items : null;
  if (!items) throw { code: 'invalid_json' };
  return items.filter(x => x && x.id != null).map(x => ({ id: String(x.id), why: String(x.why || '') }));
}

// Avis sur l'équilibre de la cave, à partir d'un résumé chiffré (aucun nom de vin). Sans recherche web.
// Analyse d'expert appuyée sur les seuls chiffres fournis, rendue en blocs lisibles : message clé, trois repères,
// points solides, manques, priorités, et une analyse détaillée. Les anciens avis (court + complet) restent lisibles.
const liste = (v, n, len) => (Array.isArray(v) ? v.map(x => String(x == null ? '' : x).trim().slice(0, len)).filter(Boolean).slice(0, n) : []);
export async function avisCave(resume, opts = {}) {
  const d = await callJson(`${EXPERT} Voici le résumé chiffré de ma cave, sans aucun nom de vin : ${JSON.stringify(resume)}. Fais une analyse d’expert, appuyée uniquement sur ces chiffres : concentration (région, appellation, cépage), répartition des couleurs et styles absents (blancs, rosés, bulles, vins de dessert), rythme de consommation (calendrier des bouteilles à boire, années creuses, pic), équilibre entre vins prêts, à garder et en urgence, profil des millésimes. Cite au moins un chiffre du résumé dans chaque constat. N’invente aucun vin, aucune note, aucun prix ; si une donnée manque, dis-le. Réponds en français, uniquement par un objet JSON de ce format : {"court":"le message le plus important, 2 phrases au maximum","cles":["3 messages clés de 8 mots au maximum"],"solide":["2 à 4 points forts, une phrase chacun, chiffrés"],"manque":["2 à 4 manques ou risques, une phrase chacun, chiffrés"],"priorite":["3 achats ou actions à faire en priorité : type de vin ou appellation, pourquoi, pour boire quand ; jamais de nom de cuvée ni de prix"],"complet":"analyse détaillée de 8 à 12 phrases en 3 ou 4 paragraphes séparés par une ligne vide, avec des conseils concrets d’accords et d’achats"}. Ce sont des impressions fondées sur des chiffres, pas des faits vérifiés.`, { ...opts });
  if (!d || typeof d !== 'object' || typeof d.court !== 'string' || !d.court.trim()) throw { code: 'invalid_json' };
  const out = { court: d.court.trim().slice(0, 400), complet: typeof d.complet === 'string' ? d.complet.trim().slice(0, 3500) : '' };
  const cles = liste(d.cles, 3, 70), solide = liste(d.solide, 4, 260), manque = liste(d.manque, 4, 260), priorite = liste(d.priorite, 3, 300);
  if (solide.length || manque.length || priorite.length) Object.assign(out, { cles, solide, manque, priorite });
  return out;
}

// Valeur indicative : fourchette de prix d'une bouteille de 75 cl par vin, sans recherche web, par lot.
export async function estimeValeur(list, opts = {}) {
  list = capGratuit(list); opts = { ...opts, unites: list.length };
  const d = await callJson(`${EXPERT} Pour chaque vin de la liste, donne une fourchette indicative du prix de marché en euros d'une bouteille de 75 cl (min et max), à partir de tes connaissances, sans recherche. Si tu ne connais pas la cuvée, donne une fourchette large et prudente. Vins : ${JSON.stringify(list.map(w => ({ id: w.id, n: w.name, d: w.dom, y: w.year, c: w.color, r: w.region })))}. Réponds uniquement par {"items":[{"id":"…","min":0,"max":0}]} avec une entrée par vin.`, opts);
  const items = Array.isArray(d) ? d : d && Array.isArray(d.items) ? d.items : null;
  if (!items) throw { code: 'invalid_json' };
  const out = new Map();
  for (const x of items) {
    const min = Number(x && x.min), max = Number(x && x.max);
    if (x && x.id != null && min > 0) out.set(String(x.id), { min, max: max >= min ? max : min, date: Date.now() });
  }
  return out;
}

export async function testKey(opts) {
  const d = await callJson('Réponds uniquement par l’objet JSON {"ok":true}.', opts);
  return !!(d && d.ok);
}
