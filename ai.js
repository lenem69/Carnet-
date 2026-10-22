// IA optionnelle : lecture d'étiquettes, fiches, accords. Fournisseur au choix, clé saisie par l'utilisateur.
// L'appli fonctionne entièrement sans IA ; ce module n'est appelé que sur action explicite.
import { sleep } from './util.js';
import { normColor } from './logic.js';

export const PROVIDERS = {
  gemini: { label: 'Gemini (Google)', model: 'gemini-3.5-flash-lite', help: 'Clé gratuite sur aistudio.google.com → « Get API key ». Pour mieux lire les étiquettes difficiles : gemini-3.8-flash.' },
  anthropic: { label: 'Claude (Anthropic)', model: 'claude-haiku-5-5', help: 'Clé API payante sur console.anthropic.com (différente d’un abonnement Claude.ai).' },
  openai: { label: 'Compatible OpenAI (avancé)', model: '', base: 'https://api.openai.com/v1', help: 'OpenAI, Mistral, Groq, OpenRouter… Renseignez l’adresse de l’API et le modèle (avec lecture d’images pour le scan).' },
};

export const cfg = { retryDelay: 20000, retries: 2, timeout: 90000 };

const KEY = 'cave-ai';
export function getSettings() {
  let s = {};
  try { s = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { s = {}; }
  const provider = PROVIDERS[s.provider] ? s.provider : 'gemini';
  return { provider, key: s.key || '', model: s.model || PROVIDERS[provider].model, base: s.base || PROVIDERS[provider].base || '' };
}
export function setSettings(s) {
  localStorage.setItem(KEY, JSON.stringify({ provider: s.provider, key: (s.key || '').trim(), model: (s.model || '').trim(), base: (s.base || '').trim().replace(/\/+$/, '') }));
}
export const ready = () => !!getSettings().key;

export const ERR = {
  no_key: 'Aucune IA configurée. Ajoutez une clé dans Réglages (⚙).',
  bad_key: 'Clé IA refusée. Vérifiez-la dans Réglages (⚙).',
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
  if (ERR[c]) return ERR[c];
  const m = (e && e.message) || '';
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
  const msg = (j && j.error && (j.error.message || j.error.type)) || '';
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

async function callOnce(prompt, images, signal, out) {
  const s = getSettings();
  if (!s.key) throw { code: 'no_key' };
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
  // Gemini (par défaut) ; avec `search`, Gemini consulte le web (Google Search) avant de répondre.
  const search = !!(out && out.search && s.provider === 'gemini');
  if (out) out.searched = search;
  const parts = [{ text: prompt }, ...b64.map(d => ({ inline_data: { mime_type: 'image/jpeg', data: d } }))];
  const j = await httpJson('https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(s.model) + ':generateContent', {
    method: 'POST', signal,
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': s.key },
    body: JSON.stringify(search
      ? { contents: [{ role: 'user', parts }], tools: [{ google_search: {} }], generationConfig: { temperature: 0.2 } }
      : { contents: [{ role: 'user', parts }], generationConfig: { responseMimeType: 'application/json', temperature: 0.2 } }),
  });
  const c = j.candidates && j.candidates[0];
  if (search && out) out.sources = webSources(c);
  const t = c && c.content && c.content.parts ? c.content.parts.map(p => p.text || '').join('') : '';
  if (!t) throw { code: j.promptFeedback && j.promptFeedback.blockReason ? 'blocked' : 'invalid_json' };
  return parseJsonLoose(t);
}

// Appel avec délai maximal, arrêt possible, et nouvelle tentative automatique si la limite par minute est atteinte.
export async function callJson(prompt, { images = [], signal, onWait, out } = {}) {
  for (let attempt = 0; ; attempt++) {
    const ac = new AbortController();
    const stop = () => ac.abort();
    if (signal) { if (signal.aborted) throw Object.assign(new Error('abort'), { name: 'AbortError' }); signal.addEventListener('abort', stop, { once: true }); }
    const timer = setTimeout(() => { ac.timedOut = true; ac.abort(); }, cfg.timeout);
    try {
      return await callOnce(prompt, images, ac.signal, out);
    } catch (e) {
      if (e && e.name === 'AbortError') { if (ac.timedOut) throw { code: 'timeout' }; throw e; }
      if (e && e.code === 'rate_limited' && attempt < cfg.retries) {
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

/* ---------- Demandes métier ---------- */
const SCHEMA_LABEL = '{"name":"cuvée","dom":"domaine/château","year":2019,"color":"Rouge|Blanc|Rosé|Pétillant|Autre","region":"appellation","grape":"cépages","lecture":"haute si tout est lisible, moyenne si tu as dû deviner une partie, faible sinon"}';
const SCHEMA_FICHE = '{"grape":"cépages","story":"2-3 phrases sur la cuvée, le domaine et le millésime","from":année de début de garde,"to":année de fin de garde,"pairings":["4 à 6 plats précis"],"conf":"vérifiée si les pages web consultées confirment cette cuvée, ce millésime et la fenêtre de garde, sinon estimée"}';
const EXPERT = 'Tu es un sommelier expert de 30 ans d’expérience, qui connaît les grands guides (RVF, Bettane+Desseauve, Parker, Decanter).';

export async function scanLabel(file, opts) {
  const blob = await shrinkImage(file);
  const d = await callJson(`${EXPERT} L’image est la photo d’une étiquette de bouteille de vin. Lis l’étiquette et identifie le vin. N’invente jamais un nom : écris ce que tu lis. Réponds uniquement par un objet JSON de ce format : ${SCHEMA_LABEL}. Si l’image n’est pas une étiquette de vin lisible, réponds {"error":true}.`, { ...opts, images: [blob] });
  if (!d || typeof d !== 'object' || d.error || !(d.name || d.dom)) throw { code: 'not_label' };
  return { name: d.name || d.dom, dom: d.dom || '', year: d.year, color: normColor(d.color), region: d.region || '', grape: d.grape || '', lecture: String(d.lecture || '').toLowerCase().startsWith('haute') ? 'haute' : 'douteuse' };
}

export async function makeFiche(w, opts = {}) {
  const year = new Date().getFullYear();
  const ask = web => `${EXPERT} ${web ? 'Utilise la recherche web et croise plusieurs sources fiables : site du domaine, guides et revues (RVF, Bettane+Desseauve, Parker, Decanter), forums spécialisés (La Passion du Vin, CellarTracker…), sites de vente en ligne avec fiches produit (Vinatis, V and B, Millésima, Idealwine…), cavistes et notes de dégustation. Compare les fenêtres de garde données par ces sources puis complète la fiche' : 'Complète la fiche de ce vin avec tes connaissances (estime si la cuvée t’est inconnue, sans inventer de faits précis)'} : ${JSON.stringify({ name: w.name, dom: w.dom, year: w.year, color: w.color, region: w.region })}. Nous sommes en ${year}. Ne donne jamais une date de garde précise sans base : en cas de doute, élargis la fourchette et mets conf à « estimée » ; ne retiens « vérifiée » que si au moins deux sources concordent ou si la source est le domaine lui-même. Réponds uniquement par un objet JSON de ce format : ${SCHEMA_FICHE}.`;
  let out = { search: getSettings().provider === 'gemini' };
  let d;
  try {
    d = await callJson(ask(out.search), { ...opts, out });
  } catch (e) {
    // La recherche web est un plus : si elle est refusée par le service, on refait sans elle.
    if (!(out.search && e && e.code === 'server')) throw e;
    out = { search: false };
    d = await callJson(ask(false), { ...opts, out });
    out.fallback = true;
  }
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

function ficheFrom(d) {
  return {
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
  const year = new Date().getFullYear();
  const d = await callJson(`${EXPERT} Pour chaque vin de la liste, complète : g=cépages, s=histoire de la cuvée et du millésime en 1 à 2 phrases, f=année de début de garde, t=année de fin de garde (nous sommes en ${year}), p=4 accords mets courts, c="estimée". Vins : ${JSON.stringify(list.map(w => ({ id: w.id, n: w.name, d: w.dom, y: w.year, c: w.color, r: w.region })))}. Réponds uniquement par un objet JSON {"items":[{"id":"…","g":"…","s":"…","f":2026,"t":2030,"p":["…"],"c":"estimée"}]} avec une entrée par vin.`, opts);
  const items = Array.isArray(d) ? d : d && Array.isArray(d.items) ? d.items : null;
  if (!items) throw { code: 'invalid_json' };
  const out = new Map();
  for (const x of items) if (x && x.id != null) out.set(String(x.id), ficheFrom(x));
  return out;
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

export async function testKey(opts) {
  const d = await callJson('Réponds uniquement par l’objet JSON {"ok":true}.', opts);
  return !!(d && d.ok);
}
