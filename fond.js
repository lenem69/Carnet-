// Passe de fond, exécutée par le service worker (script classique, chargé par sw.js).
// Elle fonctionne appli fermée (tâche de fond Chrome Android). Règle : la bible d'abord (sans jeton), puis une recherche web
// par vin avec Gemini, un vin à la fois. Elle lit la clé et les vins dans IndexedDB, partage les quotas avec la page
// (meta « autoFill ») et ne réécrit un vin qu'après l'avoir relu.
// La logique (appliquer, bibleGarde) doit rester identique à logic.js : voir tests/unit.mjs.
(function () {
  const DB = 'cave-a-vin';
  const MAX_JOUR = 20;        // appels IA par jour (lots et recherches confondus), partagés avec la page
  const MAX_PASSE = 10;       // appels par passe de fond
  const LOT = 10;             // vins par appel sans recherche
  const RECH = 5;             // vins par appel de recherche web
  const ESSAIS = 2, VERROU_MS = 5 * 60e3;
  const CHAMPS = ['grape', 'story', 'pairings', 'from', 'to'];
  const COULEUR_BIBLE = { Rouge: ['R'], Blanc: ['B', 'D'], Pétillant: ['E'] };
  const vide = v => v === null || v === undefined || v === '' || (Array.isArray(v) && !v.length);
  const str = v => (v === null || v === undefined ? '' : String(v).trim());
  const norm = s => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
  const num = v => {
    if (v === null || v === undefined || v === '') return '';
    const n = parseInt(String(v).trim(), 10);
    return Number.isNaN(n) ? '' : n;
  };

  // Mise à jour d'une fiche (copie). Un champ saisi par l'utilisateur n'est jamais écrit ; le reste l'est (option B).
  const DOUTE = ['grape', 'story', 'pairings', 'from'];
  const DOUTE_LIBELLE = { 'cépage': 'grape', histoire: 'story', garde: 'from', accords: 'pairings' };
  const toDoute = v => (Array.isArray(v) ? v.map(String).filter(k => DOUTE.includes(k)) : []);
  // Fourchette de valeur [min, max] (même règle que ai.js).
  const estimOf = v => {
    const min = Number(Array.isArray(v) ? v[0] : 0), max = Number(Array.isArray(v) ? v[1] : 0);
    return min > 0 ? { min, max: max >= min ? max : min } : null;
  };
  // Même règle que logic.js (calcDoutes).
  function calcDoutes(w, d) {
    const s = w.src || {};
    const out = new Set(toDoute(d.doute));
    if (vide(w.grape)) out.add('grape');
    if (vide(w.story)) out.add('story');
    if (vide(w.pairings)) out.add('pairings');
    if (vide(w.from) || vide(w.to)) out.add('from');
    return DOUTE.filter(k => out.has(k) && s[k] !== 'user');
  }

  // Champs à chercher : ceux signalés, ou calculés pour une fiche d'avant cette version.
  const doutesOf = w => (Array.isArray(w.aiDoute) ? w.aiDoute : calcDoutes(w, {}));

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
    if (d.searched) { w.aiSearch = now || Date.now(); w.aiDoute = []; }
    else w.aiDoute = calcDoutes(w, d);
    if (d.estim && d.estim.min > 0) { const mx = d.estim.max >= d.estim.min ? d.estim.max : d.estim.min; w.estim = { min: d.estim.min, max: mx, date: now || Date.now() }; }
    w.aiPass = now || Date.now(); w.updated = w.aiPass;
    return w;
  }

  // Bible (même règle que logic.js) : la garde vient de la bible, sauf une garde saisie par l'utilisateur.
  function bibleEntry(w, bible) {
    if (!bible || bible.v !== 1 || !Array.isArray(bible.rows) || !w.region || !w.year) return null;
    const want = COULEUR_BIBLE[w.color];
    if (!want) return null;
    const nom = norm(w.region);
    const rows = bible.rows.filter(r => r && norm(r.a) === nom && want.includes(r.c));
    if (rows.length !== 1) return null;
    const cell = rows[0].y && rows[0].y[String(w.year)];
    if (!Array.isArray(cell) || typeof cell[0] !== 'number') return null;
    return { from: cell[1], to: cell[2] };
  }
  function bibleGarde(w, bible) {
    const e = bibleEntry(w, bible);
    if (!e) return false;
    const src = { ...(w.src || {}) }; let ch = false;
    if (src.from !== 'user' && w.from !== e.from) { w.from = e.from; src.from = 'bible'; ch = true; }
    if (src.to !== 'user' && w.to !== e.to) { w.to = e.to; src.to = 'bible'; ch = true; }
    if (!ch) return false;
    w.src = src;
    if (!w.conf) w.conf = 'estimée';
    return true;
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
  async function lireBible() {
    try { const r = await fetch('bible/bible.json'); return r.ok ? await r.json() : null; } catch (e) { return null; }
  }

  // Heure de la prochaine remise à zéro des quotas Gemini (9 h UTC).
  function prochaineRemise(now) {
    const d = new Date(now); d.setUTCHours(9, 0, 0, 0);
    if (d.getTime() <= now) d.setUTCDate(d.getUTCDate() + 1);
    return d.getTime();
  }

  async function http(url, init) {
    let r;
    try { r = await fetch(url, init); } catch (e) { throw { code: 'network' }; }
    let j = null; try { j = await r.json(); } catch (e) { j = null; }
    if (!r.ok) {
      const msg = (j && j.error && (j.error.message || j.error.type)) || '';
      if (r.status === 429) throw { code: 'rate_limited', message: msg };
      if (r.status === 401 || r.status === 403 || /api[ _-]?key|authentication|unauthori/i.test(msg)) throw { code: 'bad_key', message: msg };
      if (r.status === 404 || (/model/i.test(msg) && r.status === 400)) throw { code: 'bad_model', message: msg };
      throw { code: 'server', message: r.status + (msg ? ' ' + msg : '') };
    }
    return j;
  }
  function extraire(t) {
    const s = String(t || ''); const i = s.indexOf('{'); const j = s.lastIndexOf('}');
    if (i >= 0 && j > i) { try { return JSON.parse(s.slice(i, j + 1)); } catch (e) { /* illisible */ } }
    throw { code: 'invalid_json' };
  }
  // Sites réellement consultés par Gemini (https, 5 au maximum, sans doublon).
  function sourcesWeb(cand) {
    const ch = (cand && cand.groundingMetadata && cand.groundingMetadata.groundingChunks) || [];
    const vus = new Set(); const res = [];
    for (const x of ch) {
      const w = x && x.web;
      if (!w || !/^https:\/\//i.test(w.uri || '') || vus.has(w.uri)) continue;
      vus.add(w.uri); res.push({ t: str(w.title).slice(0, 80) || 'Source', u: w.uri });
      if (res.length >= 5) break;
    }
    return res;
  }

  // Une recherche web par vin, avec la demande la plus courte possible (jetons limités).
  // Appel sans recherche : un lot de vins, une seule requête (la connaissance du modèle suffit pour la plupart des champs).
  async function lotGemini(c, lot) {
    const annee = new Date().getFullYear();
    const texte = 'Tu es sommelier expert. Pour chaque vin de la liste, sans recherche web, complète : g=cépages, s=histoire de la cuvée en 1 à 2 phrases, f=année de début de garde, t=année de fin de garde (nous sommes en ' + annee + '), p=4 accords mets courts, u=liste des champs que tu ne connais pas sûrement parmi "cépage", "histoire", "garde", "accords" (liste vide si tu es sûr). Vins : ' +
      JSON.stringify(lot.map(w => ({ id: w.id, n: w.name, d: w.dom, y: w.year, c: w.color, r: w.region }))) +
      '. Réponds uniquement par {"items":[{"id":"…","g":"","s":"","f":0,"t":0,"p":[],"u":[]}]} avec une entrée par vin.';
    const j = await http('https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(c.model || 'gemini-3.5-flash-lite') + ':generateContent', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': c.key },
      body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: texte }] }], generationConfig: { temperature: 0.2, maxOutputTokens: 4000, responseMimeType: 'application/json' } }),
    });
    const cand = j.candidates && j.candidates[0];
    const t = cand && cand.content && cand.content.parts ? cand.content.parts.map(p => p.text || '').join('') : '';
    if (!t) throw { code: 'invalid_json' };
    const obj = extraire(t);
    const items = Array.isArray(obj) ? obj : obj && Array.isArray(obj.items) ? obj.items : null;
    if (!items) throw { code: 'invalid_json' };
    const out = new Map();
    for (const x of items) {
      if (!x || x.id == null) continue;
      out.set(String(x.id), {
        grape: str(x.g), story: str(x.s), from: x.f, to: x.t,
        pairings: Array.isArray(x.p) ? x.p.map(String) : [],
        conf: 'estimée', sources: [], searched: false,
        estim: estimOf(x.v),
        doute: Array.isArray(x.u) ? [...new Set(x.u.map(u => DOUTE_LIBELLE[String(u).toLowerCase()]).filter(Boolean))] : [],
      });
    }
    return out;
  }

  // Valeur indicative seule, pour les vins déjà passés : lots de 10, sans recherche.
  async function lotValeur(c, lot) {
    const texte = 'Tu es sommelier expert. Pour chaque vin de la liste, donne une fourchette indicative du prix de marché en euros d’une bouteille de 75 cl (min et max), à partir de tes connaissances, sans recherche. Si tu ne connais pas la cuvée, donne une fourchette large et prudente. Vins : ' +
      JSON.stringify(lot.map(w => ({ id: w.id, n: w.name, d: w.dom, y: w.year, c: w.color, r: w.region }))) +
      '. Réponds uniquement par {"items":[{"id":"…","min":0,"max":0}]} avec une entrée par vin.';
    const j = await http('https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(c.model || 'gemini-3.5-flash-lite') + ':generateContent', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': c.key },
      body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: texte }] }], generationConfig: { temperature: 0.2, maxOutputTokens: 1500, responseMimeType: 'application/json' } }),
    });
    const cand = j.candidates && j.candidates[0];
    const t = cand && cand.content && cand.content.parts ? cand.content.parts.map(p => p.text || '').join('') : '';
    if (!t) throw { code: 'invalid_json' };
    const obj = extraire(t);
    const items = Array.isArray(obj) ? obj : obj && Array.isArray(obj.items) ? obj.items : null;
    if (!items) throw { code: 'invalid_json' };
    const out = new Map();
    for (const x of items) {
      const min = Number(x && x.min), max = Number(x && x.max);
      if (x && x.id != null && min > 0) out.set(String(x.id), { min, max: max >= min ? max : min });
    }
    return out;
  }

  // Recherche web par lot (une requête pour quelques vins ; sources partagées par le lot).
  async function rechercheLot(c, lot) {
    const annee = new Date().getFullYear();
    const texte = 'Tu es sommelier. Utilise la recherche web et croise des sources fiables (site du domaine, guides, cavistes). Nous sommes en ' + annee + '. Pour chaque vin de la liste, complète : g=cépages, s=histoire de la cuvée en une phrase, f=année de début de garde, t=année de fin de garde, p=4 accords mets-vins. c="vérifiée" seulement si les pages consultées confirment cette cuvée et ce millésime, sinon "estimée". Vins : ' +
      JSON.stringify(lot.map(w => ({ id: w.id, n: w.name, d: w.dom, y: w.year, c: w.color, r: w.region }))) +
      '. Réponds uniquement par {"items":[{"id":"…","g":"","s":"","f":0,"t":0,"p":[],"c":""}]} avec une entrée par vin.';
    const j = await http('https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(c.model || 'gemini-3.5-flash-lite') + ':generateContent', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': c.key },
      body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: texte }] }], tools: [{ google_search: {} }], generationConfig: { temperature: 0.2, maxOutputTokens: 2500 } }),
    });
    const cand = j.candidates && j.candidates[0];
    const t = cand && cand.content && cand.content.parts ? cand.content.parts.map(p => p.text || '').join('') : '';
    if (!t) throw { code: 'invalid_json' };
    const obj = extraire(t);
    const items = Array.isArray(obj) ? obj : obj && Array.isArray(obj.items) ? obj.items : null;
    if (!items) throw { code: 'invalid_json' };
    const sources = sourcesWeb(cand);
    const out = new Map();
    for (const x of items) {
      if (!x || x.id == null) continue;
      out.set(String(x.id), {
        grape: str(x.g), story: str(x.s), from: x.f, to: x.t,
        pairings: Array.isArray(x.p) ? x.p.map(String) : [],
        conf: sources.length && /v[ée]rifi/i.test(String(x.c || '')) ? 'vérifiée' : 'estimée',
        sources, searched: true,
      });
    }
    return out;
  }

  // Une passe : 1) la bible sur toute la cave, 2) l'IA sans recherche par lots de 10, 3) recherche web seulement
  // pour les vins dont des champs restent vides ou incertains. Tout passe par une seule limite du jour, partagée avec la page.
  async function passeIA() {
    let db;
    try { db = await ouvrir(); } catch (e) { return { ok: false, why: 'base' }; }
    let mises = 0, erreur = null, appels = 0;
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
      const c = cfg.gemini;
      if (!c || !c.key) return { ok: false, why: 'pas_de_cle' };

      // 1) La bible d'abord, sur toute la cave : aucun jeton.
      const bible = await lireBible();
      let cave = await lireVins(db);
      const bibleMaj = [];
      for (const w of cave) {
        const copie = JSON.parse(JSON.stringify(w));
        if (bibleGarde(copie, bible)) bibleMaj.push(copie);
      }
      if (bibleMaj.length) {
        const tx = db.transaction('wines', 'readwrite'); const st = tx.objectStore('wines');
        bibleMaj.forEach(w => st.put(w));
        await fin(tx);
        const ids = new Map(bibleMaj.map(w => [String(w.id), w]));
        cave = cave.map(w => ids.get(String(w.id)) || w);
      }

      if (now < (q.pauseUntil || 0) || (q.calls || 0) >= MAX_JOUR) {
        await ecrireMeta(db, 'autoFill', q);
        return { ok: true, n: 0, bible: bibleMaj.length, why: 'quota' };
      }
      const restant = () => Math.min(MAX_PASSE - appels, MAX_JOUR - (q.calls || 0));

      await ecrireMeta(db, 'passeVerrou', now);

      // 2) IA sans recherche : vins jamais passés, par lots de LOT.
      const aFaire = cave.filter(w => !w.aiPass && w.qty > 0 && (q.tries[w.id] || 0) < ESSAIS);
      for (let i = 0; i < aFaire.length && restant() > 0 && !erreur; i += LOT) {
        const lot = aFaire.slice(i, i + LOT);
        q.calls = (q.calls || 0) + 1; appels++;
        let res = null;
        try { res = await lotGemini(c, lot); }
        catch (e) { erreur = e; break; }
        // Relecture avant écriture : une modification faite entre-temps est gardée.
        const frais = await lireVins(db);
        for (const v of lot) {
          const d = res.get(String(v.id));
          const cur = frais.find(w => String(w.id) === String(v.id));
          if (!d) { q.tries[v.id] = (q.tries[v.id] || 0) + 1; continue; }
          if (!cur || cur.aiPass) continue;
          const tx = db.transaction('wines', 'readwrite');
          tx.objectStore('wines').put(appliquer(JSON.parse(JSON.stringify(cur)), d, now));
          await fin(tx);
          mises++;
        }
      }

      // 2b) Valeur indicative pour les vins déjà passés sans estimation (lots de 10, sans recherche).
      if (!erreur) {
        const sansValeur = cave.filter(w => w.aiPass && !w.estim && w.qty > 0 && (q.tries[w.id] || 0) < ESSAIS);
        for (let i = 0; i < sansValeur.length && restant() > 0 && !erreur; i += LOT) {
          const lot = sansValeur.slice(i, i + LOT);
          q.calls = (q.calls || 0) + 1; appels++;
          let res = null;
          try { res = await lotValeur(c, lot); }
          catch (e) { erreur = e; break; }
          const frais = await lireVins(db);
          for (const v of lot) {
            const e = res.get(String(v.id));
            const cur = frais.find(w => String(w.id) === String(v.id));
            if (!e) { q.tries[v.id] = (q.tries[v.id] || 0) + 1; continue; }
            if (!cur || cur.estim) continue;
            const cp = JSON.parse(JSON.stringify(cur));
            cp.estim = { min: e.min, max: e.max, date: now };
            const tx = db.transaction('wines', 'readwrite');
            tx.objectStore('wines').put(cp);
            await fin(tx);
            mises++;
          }
        }
      }

      // 3) Recherche web par lots de RECH vins, seulement pour les champs restés vides ou incertains.
      if (!erreur) {
        cave = await lireVins(db);
        const aChercher = cave.filter(w => w.aiPass && !w.aiSearch && w.qty > 0 && doutesOf(w).length && (q.tries[w.id] || 0) < ESSAIS)
          .sort((a, b) => (b.qty > 0) - (a.qty > 0));
        for (let i = 0; i < aChercher.length && restant() > 0 && !erreur; i += RECH) {
          const lot = aChercher.slice(i, i + RECH);
          q.calls = (q.calls || 0) + 1; appels++;
          let res = null;
          try { res = await rechercheLot(c, lot); }
          catch (e) { erreur = e; lot.forEach(v => { q.tries[v.id] = (q.tries[v.id] || 0) + 1; }); break; }
          const frais = await lireVins(db);
          for (const v of lot) {
            const d = res.get(String(v.id));
            const cur = frais.find(w => String(w.id) === String(v.id));
            if (!d) { q.tries[v.id] = (q.tries[v.id] || 0) + 1; continue; }
            if (!cur || cur.aiSearch) continue;
            const tx = db.transaction('wines', 'readwrite');
            tx.objectStore('wines').put(appliquer(JSON.parse(JSON.stringify(cur)), d, now));
            await fin(tx);
            mises++;
          }
        }
      }

      if (erreur) {
        const code = erreur.code;
        if (code === 'rate_limited') { q.pauseUntil = prochaineRemise(now); q.pauseWhy = 'limite de l’IA atteinte'; }
        else if (['bad_key', 'bad_model', 'bad_base', 'no_key'].includes(code)) { q.pauseUntil = now + 864e5; q.pauseWhy = 'clé ou modèle d’IA à vérifier'; }
        else { q.pauseUntil = now + 30 * 6e4; q.pauseWhy = 'connexion ou serveur indisponible'; }
      } else q.pauseUntil = 0;
      if (mises) q.lastOk = now;
      await ecrireMeta(db, 'autoFill', q);
      await ecrireMeta(db, 'passeVerrou', 0);
      if (mises && self.clients) {
        const liste = await self.clients.matchAll({ includeUncontrolled: true });
        liste.forEach(x => x.postMessage({ type: 'PASSE_IA_FIN', n: mises }));
      }
      return { ok: !erreur, n: mises, bible: bibleMaj.length, why: erreur ? (erreur.code || 'erreur') : '' };
    } catch (e) {
      return { ok: false, why: (e && e.code) || 'erreur' };
    } finally {
      try { await ecrireMeta(db, 'passeVerrou', 0); } catch (e) { /* déjà libéré */ }
      db.close();
    }
  }

  self.passeIA = passeIA;
  self.FondIA = { appliquer, bibleGarde };
})();
