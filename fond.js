// Passe IA en arrière-plan, exécutée par le service worker (script classique, chargé par sw.js).
// Elle fonctionne appli fermée (tâche de fond Chrome Android). Elle lit la clé et les vins dans IndexedDB,
// partage les quotas avec la page (meta « autoFill ») et ne réécrit un vin qu'après l'avoir relu.
// La logique de mise à jour (appliquer) doit rester identique à logic.js (applyAi) : voir tests/unit.mjs.
(function () {
  const DB = 'cave-a-vin';
  const ORDER = ['gemini', 'openai', 'anthropic'];
  const MODELE = { gemini: 'gemini-3.5-flash-lite', openai: 'gpt-4o-mini', anthropic: 'claude-haiku-5-5' };
  const BASE_OPENAI = 'https://api.openai.com/v1';
  const MAX_APPELS = 4, ESSAIS = 2, VERROU_MS = 5 * 60e3;
  const CHAMPS = ['grape', 'story', 'pairings', 'from', 'to'];
  const vide = v => v === null || v === undefined || v === '' || (Array.isArray(v) && !v.length);
  const str = v => (v === null || v === undefined ? '' : String(v).trim());
  const num = v => {
    if (v === null || v === undefined || v === '') return '';
    const n = parseInt(String(v).trim(), 10);
    return Number.isNaN(n) ? '' : n;
  };

  // Mise à jour d'une fiche (copie). Un champ saisi par l'utilisateur n'est jamais écrit ; tout le reste l'est
  // (y compris les anciennes fiches sans origine : décision de l'utilisateur, option B).
  function appliquer(w, d, now) {
    const src = { ...(w.src || {}) };
    const p = {
      grape: str(d.grape), story: str(d.story),
      pairings: Array.isArray(d.pairings) ? d.pairings.map(str).filter(Boolean) : [],
      from: num(d.from), to: num(d.to),
    };
    for (const k of CHAMPS) {
      const v = p[k];
      if (vide(v) || src[k] === 'user') continue;
      w[k] = v; src[k] = 'ai';
    }
    w.src = src;
    if (w.from && w.to && w.from > w.to) { const t = w.from; w.from = w.to; w.to = t; }
    if (d.conf) w.conf = w.conf === 'vérifiée' ? 'vérifiée' : d.conf;
    if (d.sources && d.sources.length) w.sources = d.sources;
    w.aiPass = now || Date.now(); w.updated = w.aiPass;
    return w;
  }

  function ouvrir() {
    return new Promise((res, rej) => {
      const r = indexedDB.open(DB);
      // Ne jamais créer la base ici : la page la crée avec ses magasins. Sans magasins, on renonce.
      r.onupgradeneeded = () => { try { r.transaction.abort(); } catch (e) { /* rien */ } };
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error || new Error('base indisponible'));
    });
  }
  const fin = tx => new Promise((res, rej) => { tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); tx.onabort = () => rej(tx.error || new Error('annulé')); });
  function lireMeta(db, cle) {
    return new Promise((res, rej) => {
      const q = db.transaction('meta', 'readonly').objectStore('meta').get(cle);
      q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error);
    });
  }
  async function ecrireMeta(db, cle, valeur) {
    const tx = db.transaction('meta', 'readwrite');
    tx.objectStore('meta').put(valeur, cle);
    await fin(tx);
  }
  function lireVins(db) {
    return new Promise((res, rej) => {
      const q = db.transaction('wines', 'readonly').objectStore('wines').getAll();
      q.onsuccess = () => res(q.result || []); q.onerror = () => rej(q.error);
    });
  }

  // Heure de la prochaine remise à zéro des quotas Gemini (9 h UTC).
  function prochaineRemise(now) {
    const d = new Date(now); d.setUTCHours(9, 0, 0, 0);
    if (d.getTime() <= now) d.setUTCDate(d.getUTCDate() + 1);
    return d.getTime();
  }

  function codeErreur(r, j) {
    const msg = (j && j.error && (j.error.message || j.error.type)) || '';
    if (r.status === 429) return { code: 'rate_limited', message: msg };
    if (r.status === 401 || r.status === 403 || /api[ _-]?key|authentication|unauthori/i.test(msg)) return { code: 'bad_key', message: msg };
    if (r.status === 404 || (/model/i.test(msg) && r.status === 400)) return { code: 'bad_model', message: msg };
    return { code: 'server', message: r.status + (msg ? ' ' + msg : '') };
  }
  async function http(url, init) {
    let r;
    try { r = await fetch(url, init); } catch (e) { throw { code: 'network' }; }
    let j = null; try { j = await r.json(); } catch (e) { j = null; }
    if (!r.ok) throw codeErreur(r, j);
    return j;
  }
  function extraire(t) {
    const s = String(t || ''); const i = s.indexOf('{'); const j = s.lastIndexOf('}');
    if (i >= 0 && j > i) { try { return JSON.parse(s.slice(i, j + 1)); } catch (e) { /* illisible */ } }
    throw { code: 'invalid_json' };
  }

  // Même demande en lot que ai.js (makeFiches) : 10 vins par appel.
  function consigne(vins) {
    const annee = new Date().getFullYear();
    return 'Tu es un sommelier expert de 30 ans d’expérience, qui connaît les grands guides (RVF, Bettane+Desseauve, Parker, Decanter). Pour chaque vin de la liste, complète ou corrige si besoin : g=cépages, s=histoire de la cuvée et du millésime en 1 à 2 phrases, f=année de début de garde, t=année de fin de garde (nous sommes en ' + annee + '), p=4 accords mets courts, c="estimée". Vins : ' +
      JSON.stringify(vins.map(w => ({ id: w.id, n: w.name, d: w.dom, y: w.year, c: w.color, r: w.region }))) +
      '. Réponds uniquement par un objet JSON {"items":[{"id":"…","g":"…","s":"…","f":2026,"t":2030,"p":["…"],"c":"estimée"}]} avec une entrée par vin.';
  }
  async function appeler(prov, c, vins) {
    const texte = consigne(vins);
    let t;
    if (prov === 'gemini') {
      const j = await http('https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(c.model || MODELE.gemini) + ':generateContent', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': c.key },
        body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: texte }] }], generationConfig: { responseMimeType: 'application/json', temperature: 0.2 } }),
      });
      const cand = j.candidates && j.candidates[0];
      t = cand && cand.content && cand.content.parts ? cand.content.parts.map(p => p.text || '').join('') : '';
    } else if (prov === 'openai') {
      const base = /^https:\/\//.test(c.base || '') ? c.base : BASE_OPENAI;
      const j = await http(base + '/chat/completions', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + c.key },
        body: JSON.stringify({ model: c.model || MODELE.openai, messages: [{ role: 'user', content: texte }], response_format: { type: 'json_object' }, temperature: 0.2 }),
      });
      t = j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content;
    } else {
      const j = await http('https://api.anthropic.com/v1/messages', {
        method: 'POST', headers: { 'content-type': 'application/json', 'x-api-key': c.key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
        body: JSON.stringify({ model: c.model || MODELE.anthropic, max_tokens: 4096, messages: [{ role: 'user', content: texte }] }),
      });
      t = (j.content || []).filter(p => p.type === 'text').map(p => p.text).join('');
    }
    if (!t) throw { code: 'invalid_json' };
    const d = extraire(t);
    const items = Array.isArray(d) ? d : d && Array.isArray(d.items) ? d.items : null;
    if (!items) throw { code: 'invalid_json' };
    const out = new Map();
    for (const x of items) {
      if (!x || x.id == null) continue;
      out.set(String(x.id), {
        grape: String(x.g || ''), story: String(x.s || ''), from: x.f, to: x.t,
        pairings: Array.isArray(x.p) ? x.p.map(String) : [], conf: 'estimée',
      });
    }
    return out;
  }

  // Une passe : quotas partagés avec la page, un appel au plus, écriture seulement après relecture du vin.
  async function passeIA() {
    let db;
    try { db = await ouvrir(); } catch (e) { return { ok: false, why: 'base' }; }
    try {
      const cfg = (await lireMeta(db, 'aiCfg')) || {};
      const auto = (await lireMeta(db, 'autoFill')) || {};
      const verrou = (await lireMeta(db, 'passeVerrou')) || 0;
      const now = Date.now();
      if (auto.on === false) return { ok: false, why: 'desactive' };
      if (now - verrou < VERROU_MS) return { ok: false, why: 'occupee' };
      const jour = new Date(now).toISOString().slice(0, 10);
      const q = { ...auto, tries: { ...(auto.tries || {}) } };
      if (q.day !== jour) { q.day = jour; q.calls = 0; }
      if (now < (q.pauseUntil || 0) || (q.calls || 0) >= MAX_APPELS) return { ok: false, why: 'quota' };
      const prov = ORDER.find(p => cfg[p] && cfg[p].key);
      if (!prov) return { ok: false, why: 'pas_de_cle' };
      const vins = (await lireVins(db)).filter(w => !w.aiPass && (q.tries[w.id] || 0) < ESSAIS)
        .sort((a, b) => (b.qty > 0) - (a.qty > 0)).slice(0, 10);
      if (!vins.length) return { ok: true, n: 0 };

      await ecrireMeta(db, 'passeVerrou', now);
      q.calls = (q.calls || 0) + 1;
      let res = null, mises = 0, erreur = null;
      try { res = await appeler(prov, cfg[prov], vins); }
      catch (e) { erreur = e; }
      if (res) {
        // Relecture : on n'écrit que sur les vins tels qu'ils sont maintenant (une modification entre-temps est gardée).
        const actuels = new Map((await lireVins(db)).map(w => [String(w.id), w]));
        const tx = db.transaction('wines', 'readwrite'); const st = tx.objectStore('wines');
        for (const v of vins) {
          const d = res.get(String(v.id));
          if (!d) { q.tries[v.id] = (q.tries[v.id] || 0) + 1; continue; }
          const cur = actuels.get(String(v.id));
          if (!cur || cur.aiPass) continue;
          st.put(appliquer(JSON.parse(JSON.stringify(cur)), d, now)); mises++;
        }
        await fin(tx);
        q.pauseUntil = 0;
      } else {
        vins.forEach(v => { q.tries[v.id] = (q.tries[v.id] || 0) + 1; });
        const code = erreur && erreur.code;
        if (code === 'rate_limited') { q.pauseUntil = prochaineRemise(now); q.pauseWhy = 'limite de l’IA atteinte'; }
        else if (['bad_key', 'bad_model', 'bad_base', 'no_key'].includes(code)) { q.pauseUntil = now + 864e5; q.pauseWhy = 'clé ou modèle d’IA à vérifier'; }
        else { q.pauseUntil = now + 30 * 6e4; q.pauseWhy = 'connexion ou serveur indisponible'; }
      }
      await ecrireMeta(db, 'autoFill', q);
      await ecrireMeta(db, 'passeVerrou', 0);
      if (mises && self.clients) {
        const liste = await self.clients.matchAll({ includeUncontrolled: true });
        liste.forEach(c => c.postMessage({ type: 'PASSE_IA_FIN', n: mises }));
      }
      return { ok: !erreur, n: mises, why: erreur ? (erreur.code || 'erreur') : '' };
    } catch (e) {
      return { ok: false, why: (e && e.code) || 'erreur' };
    } finally {
      try { await ecrireMeta(db, 'passeVerrou', 0); } catch (e) { /* déjà libéré */ }
      db.close();
    }
  }

  self.passeIA = passeIA;
  self.FondIA = { appliquer };
})();
