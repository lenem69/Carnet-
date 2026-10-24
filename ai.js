// IA optionnelle : lecture d'étiquettes, fiches, accords. Fournisseur au choix, clé saisie par l'utilisateur.
// L'appli fonctionne entièrement sans IA ; ce module n'est appelé que sur action explicite.
import { sleep, symPct } from './util.js';
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
// Relais Groq : clé gratuite partagée, gardée secrète dans un relais Cloudflare (jamais dans l’appli ni le dépôt).
// Sans clé personnelle, il prend le relais sans rien afficher (étiquettes après la lecture gratuite du jour, fiches, valeur,
// accords, avis de Magic une fois par jour) ; avec une clé Gemini personnelle, il ne sert qu’en secours quand elle est épuisée.
// Limite : LIMITE_RELAIS vins par jour et par appareil. Même interrupteur que la clé gratuite (cave-gratuit).
export const RELAIS = 'https://cave-groq.m-jeanfrancois-morin.workers.dev';
export const LIMITE_RELAIS = 10;
let relais = { jour: '', vins: 0 };
let avisRelaisJour = '';
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
  try { const g = await store.getMeta('relais'); if (g && g.jour === aujourdhui()) relais = { jour: g.jour, vins: g.vins || 0 }; } catch (e) { /* compteur à zéro */ }
  try { avisRelaisJour = (await store.getMeta('avisRelais')) || ''; } catch (e) { /* sans effet */ }
  syncCfg();
}
const gratuitActif = () => { try { return localStorage.getItem('cave-gratuit') !== 'off'; } catch (e) { return true; } };
export const gratuitReste = () => Math.max(0, LIMITE_GRATUITE - (gratuit.jour === aujourdhui() ? gratuit.vins : 0));
// Mode Gemini : « direct » (clé personnelle), « gratuit » (clé partagée, sous la limite) ou '' (aucun).
const modeGemini = () => { if (getConfig('gemini').key) return 'direct'; return appareil && gratuitActif() && gratuitReste() > 0 ? 'gratuit' : ''; };
const gratuitBloque = () => !!appareil && gratuitActif() && !getConfig('gemini').key && gratuitReste() === 0;
export const relaisReste = () => Math.max(0, LIMITE_RELAIS - (relais.jour === aujourdhui() ? relais.vins : 0));
const relaisDispo = () => !!appareil && gratuitActif() && relaisReste() > 0;
// Une clé personnelle chez au moins un fournisseur (Gemini, Claude ou compatible OpenAI).
const persoKeys = () => ORDER.some(p => !!getConfig(p).key);
// Pour un lot : sans clé personnelle, on ne demande que ce qui reste sous la limite du jour du relais.
export function capGratuit(list) {
  if (!persoKeys() && relaisDispo()) return list.slice(0, Math.max(1, relaisReste()));
  return modeGemini() === 'gratuit' ? list.slice(0, Math.max(1, gratuitReste())) : list;
}
async function compterRelais(n) {
  const jour = aujourdhui();
  if (relais.jour !== jour) relais = { jour, vins: 0 };
  try { const g = await store.getMeta('relais'); if (g && g.jour === jour && g.vins > relais.vins) relais.vins = g.vins; } catch (e) { /* compteur local */ }
  relais.vins += n;
  try { await store.setMeta('relais', { ...relais }); } catch (e) { /* le compteur reste en mémoire pour cette session */ }
}
// Le relais refuse l’appareil (limite du jour atteinte côté serveur) : on aligne le compteur local.
async function relaisPlein() { relais = { jour: aujourdhui(), vins: LIMITE_RELAIS }; try { await store.setMeta('relais', { ...relais }); } catch (e) { /* sans effet */ } }
async function compter(n) {
  const jour = aujourdhui();
  if (gratuit.jour !== jour) gratuit = { jour, vins: 0 };
  // La passe de fond peut avoir compté entre-temps : on repart du compteur enregistré.
  try { const g = await store.getMeta('gratuit'); if (g && g.jour === jour && g.vins > gratuit.vins) gratuit.vins = g.vins; } catch (e) { /* compteur local */ }
  gratuit.vins += n;
  try { await store.setMeta('gratuit', { ...gratuit }); } catch (e) { /* le compteur reste en mémoire pour cette session */ }
}
export const configured = () => { const l = ORDER.filter(p => (p === 'gemini' ? !!modeGemini() : getConfig(p).key)); if (relaisDispo()) l.push('groq'); return l; };
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
// La lecture gratuite d’étiquette du jour est utilisée et aucune clé personnelle.
export const limiteAtteinte = () => gratuitBloque();
// Lecture d’étiquette possible : Gemini (clé perso ou lecture gratuite du jour), Claude ou compatible OpenAI. Le relais n’a pas de vision.
export const scanDispo = () => ORDER.some(p => (p === 'gemini' ? !!modeGemini() : !!getConfig(p).key));
export const relaisPossible = relaisDispo;
// Relais épuisé pour aujourd’hui, sans clé personnelle : on invite à saisir sa clé Gemini.
export const relaisEpuise = () => !!appareil && gratuitActif() && !persoKeys() && relaisReste() === 0;
// Le service gratuit partagé ne permet qu’un appel : pas de seconde lecture en cas de doute.
const enGratuit = () => modeGemini() === 'gratuit';
// Une IA personnelle est disponible (clé saisie par l’utilisateur).
export const iaPerso = () => configured().some(p => p !== 'groq' && (p !== 'gemini' || !!getConfig('gemini').key));
// IA utilisable pour les fiches, la valeur et les accords : clé personnelle, ou relais offert sous sa limite du jour.
export const iaDispo = () => iaPerso() || relaisDispo();
// L’avis de Magic se prépare tout seul à chaque changement : avec le relais offert, une seule fois par jour au plus.
export const avisPossible = () => iaPerso() || (relaisDispo() && avisRelaisJour !== aujourdhui());
// Clé Gemini personnelle saisie : seule condition pour les fiches automatiques et la recherche web (la clé gratuite partagée n’y sert jamais).
export const geminiPerso = () => !!getConfig('gemini').key;

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
  cle_perso: 'Cette fonction demande votre propre clé gratuite : ajoutez-la dans ⚙ Réglages, la marche à suivre y est expliquée pas à pas. L’IA gratuite du jour sert à lire les étiquettes.',
  limite_gratuite: 'Vous avez utilisé l’IA offerte d’aujourd’hui, elle revient demain. Pour l’utiliser sans limite, ajoutez votre propre clé gratuite Gemini dans ⚙ Réglages : la marche à suivre y est expliquée pas à pas.',
  relais_indispo: 'L’IA offerte n’est pas disponible pour le moment. Pour l’utiliser sans attendre, ajoutez votre propre clé gratuite Gemini dans ⚙ Réglages : la marche à suivre y est expliquée pas à pas.',
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

// Réduit la photo (768 px, JPEG : une seule tuile d’image chez Gemini, 4 fois moins de jetons qu’à 800 px) : lecture identique, coût bien moindre.
export async function shrinkImage(file) {
  try {
    const bm = await createImageBitmap(file);
    const s = Math.min(1, 768 / Math.max(bm.width, bm.height));
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
  if (!s.key && !s.gratuit && !s.relais) throw { code: 'no_key' };
  const b64 = [];
  for (const im of images) b64.push(await toB64(im));
  if (s.provider === 'anthropic') {
    const content = b64.map(d => ({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: d } }));
    content.push({ type: 'text', text: prompt });
    const j = await httpJson('https://api.anthropic.com/v1/messages', {
      method: 'POST', signal,
      headers: { 'content-type': 'application/json', 'x-api-key': s.key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
      body: JSON.stringify({ model: s.model, max_tokens: (out && out.maxOut) || 4096, messages: [{ role: 'user', content }] }),
    });
    const t = (j.content || []).filter(p => p.type === 'text').map(p => p.text).join('');
    if (!t) throw { code: j.stop_reason === 'refusal' ? 'blocked' : 'invalid_json' };
    return parseJsonLoose(t);
  }
  if (s.provider === 'groq') {
    // Format compatible OpenAI, texte seul ; le relais choisit le modèle et ajoute la clé.
    const content = prompt;
    const j = await httpJson(RELAIS + '/v1/chat/completions', {
      method: 'POST', signal,
      headers: { 'Content-Type': 'application/json', 'x-appareil': appareil, 'x-unites': String(s.unites || 1) },
      body: JSON.stringify({ messages: [{ role: 'user', content }], response_format: { type: 'json_object' }, temperature: 0.2, max_tokens: (out && out.maxOut) || 4096, reasoning_effort: (out && out.effort) || 'low' }),
    });
    const t = j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content;
    if (!t) throw { code: 'invalid_json' };
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
  // Réflexion réduite (« low ») pour les tâches de lecture : bien plus rapide, même résultat. Refusée par un modèle ou le relais : on refait sans.
  const gen = think => { const g = { temperature: 0.2 }; if (think) g.thinkingConfig = { thinkingLevel: think }; return g; };
  let think = (out && out.think) || '';
  const call = search => httpJson((s.gratuit ? PROXY : 'https://generativelanguage.googleapis.com') + '/v1beta/models/' + encodeURIComponent(s.model) + ':generateContent', {
    method: 'POST', signal,
    headers: s.gratuit ? { 'Content-Type': 'application/json', 'x-appareil': appareil, 'x-unites': String(s.unites || 1) } : { 'Content-Type': 'application/json', 'x-goog-api-key': s.key },
    body: JSON.stringify(search
      ? { contents: [{ role: 'user', parts }], tools: [{ google_search: {} }], generationConfig: gen(think) }
      : { contents: [{ role: 'user', parts }], generationConfig: { ...gen(think), responseMimeType: 'application/json' } }),
  });
  let search = !!(out && out.wantSearch);
  let j;
  try {
    try { j = await call(search); }
    catch (e) {
      if (!(think && e && (e.code === 'server' || e.code === 'bad_model'))) throw e;
      think = ''; j = await call(search);
    }
  } catch (e) {
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
  // Le relais offert sert aussi de secours à une clé Gemini personnelle (sauf passe automatique et test de clé : noRelais).
  let list = opts.only ? configured().filter(p => p === opts.only || (p === 'groq' && opts.only === 'gemini')) : usable();
  // Le relais n'a pas de modèle d'image (la lecture d'étiquette reste à Gemini) : il ne sert qu'au texte.
  if (opts.noRelais || (opts.images && opts.images.length)) list = list.filter(p => p !== 'groq');
  // Sans clé Gemini personnelle, la clé gratuite partagée ne sert qu’à lire une étiquette (opts.gratuitOk).
  const sansPerso = !getConfig('gemini').key;
  if (sansPerso && !opts.gratuitOk) list = list.filter(p => p !== 'gemini');
  if (!list.length) throw { code: relaisEpuise() ? 'limite_gratuite' : sansPerso && !opts.gratuitOk && !!appareil && gratuitActif() ? 'cle_perso' : gratuitBloque() ? 'limite_gratuite' : 'no_key' };
  let lastErr, firstErr;
  for (let i = 0; i < list.length; i++) {
    const prov = list[i]; const last = i === list.length - 1;
    const s = prov === 'groq' ? { provider: 'groq', key: '', model: '', base: '', relais: true } : { provider: prov, ...getConfig(prov) };
    if (prov === 'gemini' && !s.key) { s.gratuit = true; s.unites = Math.max(1, opts.unites || 1); }
    if (prov === 'groq') s.unites = Math.max(1, Math.min(relaisReste() || 1, opts.unites || 1));
    else s.model = modelFor(prov, opts.task, s.model);
    try {
      const r = await callProvider(s, prompt, opts, last && !opts.noRetry && !s.relais ? cfg.retries : 0);
      uncool(prov); stat('ia_ok');
      if (s.gratuit) await compter(s.unites);
      if (s.relais) await compterRelais(s.unites);
      if (opts.out) opts.out.provider = prov;
      return r;
    } catch (e) {
      if (e && e.name === 'AbortError') throw e;
      // Relais offert : limite du jour (appareil ou quota partagé) ou panne. Sans clé personnelle, on invite à saisir sa clé ;
      // en secours d’une clé personnelle, on garde l’erreur de cette clé, la seule qui parle à l’utilisateur.
      if (s.relais) {
        if (e && e.code === 'rate_limited') { await relaisPlein(); e = { code: 'limite_gratuite' }; }
        else if (e && ['network', 'timeout', 'server', 'bad_key', 'bad_model', 'invalid_json'].includes(e.code)) e = { code: 'relais_indispo', message: e.message || '' };
        if (firstErr && persoKeys()) e = firstErr;
        if (!['limite_gratuite'].includes(e.code)) cool('groq', { code: 'server' });
        throw e;
      }
      // la clé partagée est épuisée côté serveur : on le dit comme une limite du jour, pas comme une panne
      if (s.gratuit && e && e.code === 'rate_limited') e = { code: 'limite_gratuite' };
      // refus ou panne du service gratuit : ce n’est pas la clé de l’utilisateur, on ne lui demande donc pas de la vérifier
      else if (s.gratuit && e && ['bad_key', 'bad_model', 'server'].includes(e.code)) e = { code: 'service_gratuit', message: e.message || '' };
      lastErr = e; if (!firstErr) firstErr = e;
      const code = e && e.code;
      if (STAT_OF[code]) stat(STAT_OF[code]);
      const sticky = !['bad_image', 'not_label', 'blocked'].includes(code);
      if (!opts.only && sticky) cool(prov, e);
      if (last || !sticky) throw e;
      stat('ia_relais');
      // Passage au relais offert : sans rien afficher.
      if (hooks.onSwitch && list[i + 1] !== 'groq' && !s.gratuit) hooks.onSwitch(prov, list[i + 1], e);
    }
  }
  throw lastErr;
}

/* ---------- Demandes métier ---------- */
const SCHEMA_LABEL = '{"name":"cuvée","dom":"domaine/château","year":2019,"color":"Rouge|Blanc|Rosé|Pétillant|Autre","region":"appellation","grape":"cépages","lecture":"haute si tout est lisible, moyenne si tu as dû deviner une partie, faible sinon"}';
const SCHEMA_FICHE = '{"grape":"cépages","story":"2-3 phrases sur la cuvée, le domaine et le millésime","from":année de début de garde,"to":année de fin de garde,"pairings":["4 à 6 plats précis"],"conf":"vérifiée si les pages web consultées confirment cette cuvée, ce millésime et la fenêtre de garde, sinon estimée"}';
const EXPERT = 'Tu es un sommelier expert de 30 ans d’expérience, qui connaît les grands guides (RVF, Bettane+Desseauve, Parker, Decanter). Quand tu complètes une fiche de vin, ne la laisse jamais vide : si la cuvée exacte est introuvable, déduis la fiche du domaine, de l’appellation, du millésime et de la couleur (cépages de l’appellation, style, histoire du domaine ou de la région, accords classiques, garde habituelle), et signale l’incertitude plutôt que de te taire. Écris les pourcentages avec le symbole % (par exemple 21 %), jamais en toutes lettres.';

export async function scanLabel(file, opts) {
  const t0 = performance.now();
  const blob = await shrinkImage(file);
  const prep = performance.now() - t0;
  // Lecture simple : réflexion minimale et réponse courte, pour la rapidité.
  const prompt = `Image : photo d’une étiquette de vin. Lis-la sans rien inventer. JSON : ${SCHEMA_LABEL}. Si ce n’est pas une étiquette lisible : {"error":true}.`;
  const lire = async (task, think) => {
    const out = { think, maxOut: 500 };
    const d = await callJson(prompt, { ...opts, images: [blob], task, out, gratuitOk: true });
    return { d, prov: out.provider };
  };
  const ok = d => d && typeof d === 'object' && !d.error && (d.name || d.dom);
  const sure = d => ok(d) && String(d.lecture || '').toLowerCase().startsWith('haute');
  // 1) Modèle le plus léger (rapide). 2) Si la lecture est douteuse ou refusée : le modèle précis, une seule fois, pour Gemini
  // avec le modèle par défaut (jamais un modèle choisi à la main, ni en service gratuit qui n’autorise qu’un appel).
  const t1 = performance.now();
  let r = null, err = null, precis = false;
  try { r = await lire('labelRapide', 'minimal'); } catch (e) { if (!e || e.code !== 'invalid_json') throw e; err = e; }
  const peutPrecis = !enGratuit() && (r ? r.prov === 'gemini' : getConfig('gemini').key) && getConfig('gemini').model === PROVIDERS.gemini.model && MODELE_TACHE.label.gemini !== PROVIDERS.gemini.model;
  let appel = performance.now() - t1;
  if ((!r || !sure(r.d)) && peutPrecis) {
    const t2 = performance.now();
    try { r = await lire('label', 'low'); err = null; precis = true; } catch (e) { if (!r) throw e; /* on garde la lecture légère */ }
    appel += performance.now() - t2;
  }
  if (!r) throw err || { code: 'invalid_json' };
  const d = r.d;
  if (!ok(d)) throw { code: 'not_label' };
  return { name: d.name || d.dom, dom: d.dom || '', year: d.year, color: normColor(d.color), region: d.region || '', grape: d.grape || '', lecture: String(d.lecture || '').toLowerCase().startsWith('haute') ? 'haute' : 'douteuse',
    timing: { prep: Math.round(prep), appel: Math.round(appel), precis } };
}

async function ficheAvecRecherche(w, opts = {}) {
  const year = new Date().getFullYear();
  // Recherche web seulement chez Gemini ; chez un autre fournisseur, la fiche reste une estimation.
  const ask = s => { const web = s.provider === 'gemini'; return `${EXPERT} ${web ? 'Utilise la recherche web et croise plusieurs sources fiables : site du domaine, guides et revues (RVF, Bettane+Desseauve, Parker, Decanter), forums spécialisés (La Passion du Vin, CellarTracker…), sites de vente en ligne avec fiches produit (Vinatis, V and B, Millésima, Idealwine…), cavistes et notes de dégustation. Compare les fenêtres de garde données par ces sources puis complète la fiche' : 'Complète la fiche de ce vin avec tes connaissances (estime si la cuvée t’est inconnue, sans inventer de faits précis)'} : ${JSON.stringify({ name: w.name, dom: w.dom, year: w.year, color: w.color, region: w.region })}. Nous sommes en ${year}. Ne donne jamais une date de garde précise sans base : en cas de doute, élargis la fourchette et mets conf à « estimée » ; ne retiens « vérifiée » que si au moins deux sources concordent ou si la source est le domaine lui-même. Réponds uniquement par un objet JSON de ce format : ${SCHEMA_FICHE}.`; };
  const out = { wantSearch: true };
  let d = await callJson(ask, { ...opts, out });
  if (!d || typeof d !== 'object' || Array.isArray(d)) throw { code: 'invalid_json' };
  let f = ficheFrom(d);
  // Réponse sans histoire ni accords (cas d'une recherche web qui n'a rien donné) : un second essai sans recherche web.
  if (!f.story && !f.pairings.length && out.searched) {
    const out2 = {};
    const d2 = await callJson(ask, { ...opts, out: out2 });
    if (d2 && typeof d2 === 'object' && !Array.isArray(d2)) { d = d2; f = ficheFrom(d2); f.fallback = true; Object.assign(out, { searched: false, sources: [] }); }
  }
  const sources = out.searched ? (out.sources || []) : [];
  // « vérifiée » seulement si le modèle l’affirme ET que des pages web ont réellement été consultées.
  f.conf = sources.length && /^v[ée]rifi/i.test(String(d.conf || d.c || '')) ? 'vérifiée' : 'estimée';
  f.sources = sources;
  f.searched = !!out.searched;
  f.fallback = !!out.fallback;
  return f;
}

// Fiche d'un seul vin : recherche web d'abord ; si elle échoue (réponse illisible, service, réseau) ou revient vide,
// on utilise la même méthode que la mise à jour groupée (sans recherche web), qui est la plus fiable.
export async function makeFiche(w, opts = {}) {
  const sansRecherche = async () => {
    const res = await makeFiches([{ ...w, id: '1' }], opts);
    const f = res.get('1');
    if (!f) throw { code: 'invalid_json' };
    f.searched = false; f.fallback = true;
    return f;
  };
  let f;
  try { f = await ficheAvecRecherche(w, opts); }
  catch (e) {
    const c = e && e.code;
    if (!e || e.name === 'AbortError' || !['invalid_json', 'server', 'network', 'blocked'].includes(c)) throw e;
    return sansRecherche();
  }
  if (!f.story && !f.pairings.length && !f.grape) { try { return await sansRecherche(); } catch (e) { return f; } }
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
const liste = (v, n, len) => (Array.isArray(v) ? v.map(x => symPct(String(x == null ? '' : x).trim()).slice(0, len)).filter(Boolean).slice(0, n) : []);
export async function avisCave(resume, opts = {}) {
  const meta = { effort: 'medium' };
  const d = await callJson(`${EXPERT} Tu conseilles un amateur sur sa cave comme tu le ferais autour d’une table, avec ton expérience : tu prends position, tu nommes des appellations, des styles, des années, tu expliques pourquoi et ce qu’il faut faire. Voici le résumé chiffré de sa cave, sans aucun nom de vin : ${JSON.stringify(resume)}. Appuie-toi uniquement sur ces chiffres, mais va au-delà du constat : pour chaque point, dis ce que cela implique pour le plaisir de boire, le risque (tout qui arrive à maturité la même année, années creuses, bouteilles qui passent), et l’action concrète. Regarde en particulier : la concentration (région, appellation, cépage) et ce qu’elle dit des goûts ; l’équilibre des couleurs et des styles absents (blancs secs, rosés, bulles, vins de dessert) avec des accords précis que l’on ne peut pas faire ; le calendrier à boire (pic, années creuses, bouteilles à boire vite) ; le profil des millésimes ; ce qu’un amateur averti achèterait ensuite, avec des appellations précises (jamais de nom de cuvée ni de prix), le type de garde et l’année pour la boire. Évite les banalités (« forte spécialisation », « diversité limitée ») sans explication : chaque phrase doit apprendre quelque chose. Cite au moins un chiffre du résumé dans chaque constat. N’invente aucun vin, aucune note, aucun prix ; si une donnée manque, dis-le. Réponds en français, uniquement par un objet JSON de ce format : {"court":"le message le plus important, 2 phrases au maximum, avec ton avis de sommelier","cles":["3 messages clés de 8 mots au maximum"],"solide":["2 à 4 points forts, 1 à 2 phrases chacun : constat chiffré et ce que cela permet"],"manque":["2 à 4 manques ou risques, 1 à 2 phrases chacun : constat chiffré, conséquence concrète à table ou en cave"],"priorite":["3 achats ou actions à faire en priorité : appellation ou style précis, pourquoi, pour boire quand, avec quels plats"],"complet":"analyse détaillée de 8 à 12 phrases en 3 ou 4 paragraphes séparés par une ligne vide, qui APPROFONDIT sans répéter les blocs précédents : lecture de vos goûts, stratégie de dégustation sur les 3 prochaines années, conseils d’accords et d’achats, un conseil de sommelier que l’on n’attend pas"}. Ce sont des impressions fondées sur des chiffres, pas des faits vérifiés.`, { ...opts, out: meta });
  if (meta.provider === 'groq') { avisRelaisJour = aujourdhui(); try { await store.setMeta('avisRelais', avisRelaisJour); } catch (e) { /* sans effet */ } }
  if (!d || typeof d !== 'object' || typeof d.court !== 'string' || !d.court.trim()) throw { code: 'invalid_json' };
  const out = { court: symPct(d.court.trim()).slice(0, 400), complet: typeof d.complet === 'string' ? symPct(d.complet.trim()).slice(0, 4500) : '' };
  const cles = liste(d.cles, 3, 70), solide = liste(d.solide, 4, 340), manque = liste(d.manque, 4, 340), priorite = liste(d.priorite, 3, 380);
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
  const d = await callJson('Réponds uniquement par l’objet JSON {"ok":true}.', { ...opts, noRelais: true });
  return !!(d && d.ok);
}
