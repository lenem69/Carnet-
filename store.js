// Stockage local sur le téléphone (IndexedDB), avec repli en mémoire si le navigateur le refuse.
const DB_NAME = 'cave-a-vin';
const DB_VER = 1;
let db = null;
let mem = null;
export let persistent = false;

export async function open() {
  try {
    if (!('indexedDB' in self)) throw new Error('indexedDB absent');
    db = await new Promise((resolve, reject) => {
      const r = indexedDB.open(DB_NAME, DB_VER);
      r.onupgradeneeded = () => {
        const d = r.result;
        if (!d.objectStoreNames.contains('wines')) d.createObjectStore('wines', { keyPath: 'id' });
        if (!d.objectStoreNames.contains('meta')) d.createObjectStore('meta');
      };
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error || new Error('Ouverture impossible'));
      r.onblocked = () => reject(new Error('Base bloquée par un autre onglet'));
    });
    db.onversionchange = () => { db.close(); };
    persistent = true;
  } catch (e) {
    db = null;
    mem = { wines: new Map(), meta: new Map() };
    persistent = false;
  }
  return persistent;
}

function run(storeName, mode, body) {
  return new Promise((resolve, reject) => {
    let t;
    try {
      t = db.transaction(storeName, mode);
      const out = body(t.objectStore(storeName));
      t.oncomplete = () => resolve(out && 'result' in out ? out.result : undefined);
      t.onerror = () => reject(t.error || new Error('Écriture impossible'));
      t.onabort = () => reject(t.error || new Error('Écriture annulée'));
    } catch (e) {
      try { t && t.abort(); } catch (x) { /* déjà terminée */ }
      reject(e);
    }
  });
}

export async function allWines() {
  if (!db) return [...mem.wines.values()].map(w => structuredClone(w));
  return run('wines', 'readonly', s => s.getAll());
}

export async function putWines(list) {
  if (!list.length) return;
  if (!db) { list.forEach(w => mem.wines.set(w.id, structuredClone(w))); return; }
  await run('wines', 'readwrite', s => { list.forEach(w => s.put(w)); });
}

export async function deleteWines(ids) {
  if (!db) { ids.forEach(id => mem.wines.delete(id)); return; }
  await run('wines', 'readwrite', s => { ids.forEach(id => s.delete(id)); });
}

// Remplacement complet en une seule transaction : tout ou rien.
export async function replaceAll(list) {
  if (!db) { mem.wines = new Map(list.map(w => [w.id, structuredClone(w)])); return; }
  await run('wines', 'readwrite', s => { s.clear(); list.forEach(w => s.put(w)); });
}

export async function getMeta(key) {
  if (!db) return mem.meta.get(key);
  return run('meta', 'readonly', s => s.get(key));
}

export async function setMeta(key, value) {
  if (!db) { mem.meta.set(key, value); return; }
  await run('meta', 'readwrite', s => { s.put(value, key); });
}

// Demande au navigateur de ne pas effacer les données en cas de manque de place.
export async function protect() {
  try { return navigator.storage && navigator.storage.persist ? await navigator.storage.persist() : false; } catch (e) { return false; }
}

export async function info() {
  const out = { persistent, protected: false, usage: null, quota: null };
  try { if (navigator.storage && navigator.storage.persisted) out.protected = await navigator.storage.persisted(); } catch (e) { /* inconnu */ }
  try { if (navigator.storage && navigator.storage.estimate) { const e = await navigator.storage.estimate(); out.usage = e.usage; out.quota = e.quota; } } catch (e) { /* inconnu */ }
  return out;
}
