/* Relais Groq de « Ma cave » : Cloudflare Worker (gratuit).
   La clé Groq n'est JAMAIS dans ce fichier ni dans l'appli : elle est enregistrée comme secret « GROQ_KEY » dans Cloudflare.
   Texte seul (la lecture d'étiquette reste à Gemini). Modèle principal : openai/gpt-oss-120b ; secours : openai/gpt-oss-20b.
   Facultatif : un espace KV lié sous le nom « LIMITES » applique aussi la limite par appareil côté serveur (10 vins par jour). */
const ORIGINE = 'https://lenem69.github.io';
const MODELES = ['openai/gpt-oss-120b', 'openai/gpt-oss-20b'];
const LIMITE_JOUR = 10;      // vins par jour et par appareil (même valeur que l'appli)
const MAX_SORTIE = 4096;     // jetons de réponse au plus
const MAX_CORPS = 200000;    // octets de requête au plus

const cors = { 'Access-Control-Allow-Origin': ORIGINE, 'Access-Control-Allow-Headers': 'Content-Type, x-appareil, x-unites', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Vary': 'Origin' };
const rep = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

export default {
  async fetch(req, env) {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    const url = new URL(req.url);
    if (req.method !== 'POST' || url.pathname !== '/v1/chat/completions') return rep({ error: { message: 'introuvable' } }, 404);
    if (!env.GROQ_KEY) return rep({ error: { message: 'relais non configuré' } }, 500);
    const origine = req.headers.get('Origin');
    if (origine && origine !== ORIGINE) return rep({ error: { message: 'origine refusée' } }, 403);
    const appareil = (req.headers.get('x-appareil') || '').trim();
    if (!/^[A-Za-z0-9_-]{8,80}$/.test(appareil)) return rep({ error: { message: 'appareil manquant' } }, 400);
    const unites = Math.max(1, Math.min(LIMITE_JOUR, parseInt(req.headers.get('x-unites') || '1', 10) || 1));
    const texte = await req.text();
    if (texte.length > MAX_CORPS) return rep({ error: { message: 'requête trop grande' } }, 413);
    let corps;
    try { corps = JSON.parse(texte); } catch (e) { return rep({ error: { message: 'JSON invalide' } }, 400); }
    // Texte seul : on ne garde que le contenu texte des messages.
    const messages = Array.isArray(corps.messages) ? corps.messages.slice(0, 4).map(m => ({
      role: m && m.role === 'system' ? 'system' : 'user',
      content: typeof m.content === 'string' ? m.content : (Array.isArray(m.content) ? m.content.filter(p => p && p.type === 'text').map(p => String(p.text || '')).join('\n') : ''),
    })).filter(m => m.content) : [];
    if (!messages.length) return rep({ error: { message: 'message vide' } }, 400);

    // Limite par appareil côté serveur (si l'espace KV « LIMITES » est lié).
    let cle = '', deja = 0;
    if (env.LIMITES) {
      cle = 'j:' + new Date().toISOString().slice(0, 10) + ':' + appareil;
      deja = parseInt((await env.LIMITES.get(cle)) || '0', 10) || 0;
      if (deja + unites > LIMITE_JOUR) return rep({ error: { message: 'limite du jour atteinte' } }, 429);
    }

    const demande = (modele, json) => fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + env.GROQ_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: modele, messages, temperature: Math.min(1, Number(corps.temperature) || 0.2),
        max_completion_tokens: Math.min(MAX_SORTIE, Number(corps.max_tokens) || MAX_SORTIE),
        reasoning_effort: 'low',
        ...(json ? { response_format: { type: 'json_object' } } : {}),
      }),
    });
    const veutJson = !!(corps.response_format && corps.response_format.type === 'json_object');
    let r = null;
    for (const modele of MODELES) {
      try {
        r = await demande(modele, veutJson);
        if (r.status === 400 && veutJson) r = await demande(modele, false);   // modèle sans mode JSON : on laisse l'appli extraire le JSON
      } catch (e) { r = null; continue; }
      if (r.ok) break;
      if (![429, 500, 502, 503, 504].includes(r.status)) break;   // sinon, on tente le modèle de secours
    }
    if (!r) return rep({ error: { message: 'service indisponible' } }, 503);
    if (r.ok && env.LIMITES) { try { await env.LIMITES.put(cle, String(deja + unites), { expirationTtl: 172800 }); } catch (e) { /* sans effet */ } }
    const sortie = await r.text();
    return new Response(sortie, { status: r.status, headers: { ...cors, 'Content-Type': 'application/json' } });
  },
};
